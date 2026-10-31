import { describe, expect, it } from 'vitest'
import type { EdtaFormState, EdtaRunConfig, PanRunConfig } from '../types'
import { applyMode, initialEdtaState, setExtraFile, setSwitch, toEdtaRunConfig } from './rules'
import { buildEdtaCommands, buildPanCommand, buildPanList, formatCommand } from './commandBuilder'

const file = (name: string) => new File(['x'], name)
const base = (): EdtaFormState => ({ ...initialEdtaState(), genome: file('genome.fa') })
const cfgOf = (s: EdtaFormState): EdtaRunConfig => toEdtaRunConfig(s)

describe('buildEdtaCommands — EDTA mode', () => {
  it('defaults: all off, sensitive 0, no --anno/--evaluate, no --run_LAI', () => {
    const [cmd, ...rest] = buildEdtaCommands(cfgOf(base()), 'genome.fa')
    expect(rest).toHaveLength(0)
    expect(cmd).toEqual([
      'EDTA.pl',
      '--genome',
      'genome.fa',
      '--species',
      'others',
      '--step',
      'all',
      '--sensitive',
      '0',
      '--threads',
      '10',
    ])
  })

  it('sends --evaluate explicitly whenever --anno 1', () => {
    const cmd = buildEdtaCommands(cfgOf(setSwitch(base(), 'anno', true)), 'genome.fa')[0]
    expect(formatCommand(cmd)).toContain('--anno 1 --evaluate 0')
    const ev = buildEdtaCommands(cfgOf(setSwitch(base(), 'evaluate', true)), 'genome.fa')[0]
    expect(formatCommand(ev)).toContain('--anno 1 --evaluate 1')
  })

  it('MAKER mask sends --maker 1 after --evaluate, and is omitted when off', () => {
    const on = formatCommand(
      buildEdtaCommands(cfgOf(setSwitch(base(), 'maker', true)), 'genome.fa')[0],
    )
    expect(on).toContain('--anno 1 --evaluate 0 --maker 1')
    const off = formatCommand(
      buildEdtaCommands(cfgOf(setSwitch(base(), 'anno', true)), 'genome.fa')[0],
    )
    expect(off).not.toContain('--maker')
  })

  it('never sends AnnoTEP-only flags', () => {
    const s = { ...base(), switches: { ...base().switches, runLai: true, tirFilter: true } }
    const text = formatCommand(buildEdtaCommands(cfgOf(s), 'genome.fa')[0])
    expect(text).not.toMatch(/--run_LAI|--TIR_filter|--ANNOT_TYPE/)
  })

  it('adds non-default numbers and sanitized extra file names', () => {
    let s = setSwitch(
      { ...base(), mutationRate: '7e-9', maxDiv: '30', threads: '20' },
      'anno',
      true,
    )
    s = setSwitch(s, 'overwrite', true)
    s = setSwitch(s, 'force', true)
    s = setSwitch(s, 'maker', true)
    s = setExtraFile(s, 'cds', file('my cds.fa'))
    s = setExtraFile(s, 'exclude', file('../regions.bed'))
    const text = formatCommand(buildEdtaCommands(cfgOf(s), 'genome.fa')[0])
    expect(text).toBe(
      'EDTA.pl --genome genome.fa --species others --step all --sensitive 0 --threads 20 ' +
        '--overwrite 1 --anno 1 --evaluate 0 --maker 1 --force 1 --u 7e-9 --maxdiv 30 ' +
        '--cds my_cds.fa --exclude regions.bed',
    )
  })
})

describe('buildEdtaCommands — AnnoTEP mode', () => {
  it('uses AnnoTEP/EDTA/EDTA.pl, forces sensitive/anno and adds --run_LAI and the report script', () => {
    const s = applyMode(base(), 'annotep')
    const [edta, report] = buildEdtaCommands(cfgOf(s), 'genome.fa')
    expect(formatCommand(edta)).toBe(
      'AnnoTEP/EDTA/EDTA.pl --genome genome.fa --species others --step all --sensitive 1 ' +
        '--threads 10 --anno 1 --evaluate 0 --run_LAI 1',
    )
    expect(report).toEqual(['bash', 'AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh', 'genome.fa'])
  })

  it('never sends --maker (it does not exist in AnnoTEP/EDTA/EDTA.pl)', () => {
    const s = { ...base(), switches: { ...base().switches, maker: true } }
    const text = formatCommand(buildEdtaCommands(cfgOf(applyMode(s, 'annotep')), 'genome.fa')[0])
    expect(text).not.toContain('--maker')
  })

  it('sends TIR_filter / ANNOT_TYPE only when on, and run_LAI 0 when off', () => {
    let s = applyMode(base(), 'annotep')
    s = setSwitch(setSwitch(setSwitch(s, 'tirFilter', true), 'annotType', true), 'runLai', false)
    const text = formatCommand(buildEdtaCommands(cfgOf(s), 'genome.fa')[0])
    expect(text).toContain('--TIR_filter 1 --ANNOT_TYPE 1 --run_LAI 0')
  })
})

describe('panEDTA', () => {
  const cfg: PanRunConfig = {
    email: null,
    pairs: [
      { genome: file('Ler.test.fa'), cds: null },
      { genome: file('Col.test.fa'), cds: file('genome.cds.fa') },
    ],
    cds: file('genome.cds.fa'),
    library: file('lib.fa'),
    threads: 20,
    copies: 3,
  }

  it('builds the command with -o 1 fixed', () => {
    expect(buildPanCommand(cfg, 'genome_20260101-000000.cds.list')).toEqual([
      'bash',
      'panEDTA.sh',
      '-g',
      'genome_20260101-000000.cds.list',
      '-c',
      'genome.cds.fa',
      '-l',
      'lib.fa',
      '-t',
      '20',
      '-f',
      '3',
      '-o',
      '1',
    ])
  })

  it('writes one line per pair, newline-terminated, without duplicates (legacy bug)', () => {
    expect(buildPanList(cfg)).toBe('Ler.test.fa\nCol.test.fa\tgenome.cds.fa\n')
  })
})

describe('formatCommand', () => {
  it('quotes arguments with unusual characters', () => {
    expect(formatCommand(['a', 'b c', "it's"])).toBe(`a 'b c' 'it'\\''s'`)
  })
})
