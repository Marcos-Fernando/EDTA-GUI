import { describe, expect, it } from 'vitest'
import type { PanFormState } from '../types'
import {
  addPanPair,
  applyMode,
  initialEdtaState,
  initialPanState,
  isFileEnabled,
  isSwitchLocked,
  isSwitchVisible,
  removePanPair,
  setExtraFile,
  setPanPairFile,
  setStep,
  setSwitch,
  toEdtaRunConfig,
  toPanRunConfig,
  validateEdta,
  validateMaxDiv,
  validateMutationRate,
  validatePan,
} from './rules'

const file = (name: string) => new File(['>chr1\nACGT\n'], name)
const valid = () => ({ ...initialEdtaState(), genome: file('genome.fa') })

describe('initial EDTA state', () => {
  it('starts in EDTA mode with every switch off', () => {
    const s = initialEdtaState()
    expect(s.mode).toBe('edta')
    expect(Object.values(s.switches).every((v) => v === false)).toBe(true)
    expect(s.species).toBe('others')
    expect(s.step).toBe('all')
    expect(s.threads).toBe('10')
    expect(s.maxDiv).toBe('40')
  })
})

describe('mode rules', () => {
  it('AnnoTEP forces Sensitivity and Annotation on, locked, and turns Run LAI on', () => {
    const s = applyMode(initialEdtaState(), 'annotep')
    expect(s.switches.sensitive).toBe(true)
    expect(s.switches.anno).toBe(true)
    expect(s.switches.runLai).toBe(true)
    expect(s.switches.tirFilter).toBe(false)
    expect(s.switches.annotType).toBe(false)
    expect(isSwitchLocked(s, 'sensitive')).toBe(true)
    expect(isSwitchLocked(s, 'anno')).toBe(true)
    expect(isSwitchLocked(s, 'evaluate')).toBe(false)
  })

  it('locked switches cannot be turned off in AnnoTEP', () => {
    const s = applyMode(initialEdtaState(), 'annotep')
    expect(setSwitch(s, 'sensitive', false)).toBe(s)
    expect(setSwitch(s, 'anno', false)).toBe(s)
  })

  it('back to EDTA resets Sensitivity, Annotation, Evaluate and the AnnoTEP-only switches', () => {
    let s = applyMode(initialEdtaState(), 'annotep')
    s = setSwitch(s, 'evaluate', true)
    s = setSwitch(s, 'tirFilter', true)
    s = setExtraFile(s, 'exclude', file('regions.bed'))
    s = applyMode(s, 'edta')
    expect(s.switches).toMatchObject({
      sensitive: false,
      anno: false,
      evaluate: false,
      tirFilter: false,
      annotType: false,
      runLai: false,
    })
    expect(s.files.exclude).toBeNull()
  })

  it('keeps user choices that are valid in both modes', () => {
    let s = setSwitch(initialEdtaState(), 'overwrite', true)
    s = setSwitch(s, 'force', true)
    s = applyMode(applyMode(s, 'annotep'), 'edta')
    expect(s.switches.overwrite).toBe(true)
    expect(s.switches.force).toBe(true)
  })

  it('AnnoTEP-only switches are hidden and ignored in EDTA mode', () => {
    const s = initialEdtaState()
    expect(isSwitchVisible('edta', 'runLai')).toBe(false)
    expect(isSwitchVisible('edta', 'tirFilter')).toBe(false)
    expect(isSwitchVisible('annotep', 'annotType')).toBe(true)
    expect(setSwitch(s, 'runLai', true)).toBe(s)
  })

  it('selecting the current mode returns the same state', () => {
    const s = initialEdtaState()
    expect(applyMode(s, 'edta')).toBe(s)
  })
})

describe('Annotation / Evaluate rules', () => {
  it('turning Evaluate on turns Annotation on', () => {
    const s = setSwitch(initialEdtaState(), 'evaluate', true)
    expect(s.switches.evaluate).toBe(true)
    expect(s.switches.anno).toBe(true)
  })

  it('turning Annotation off turns Evaluate off and clears exclude/rmout', () => {
    let s = setSwitch(initialEdtaState(), 'evaluate', true)
    s = setExtraFile(s, 'exclude', file('regions.bed'))
    s = setExtraFile(s, 'rmout', file('genome.out'))
    s = setExtraFile(s, 'cds', file('genome.cds.fa'))
    s = setSwitch(s, 'anno', false)
    expect(s.switches.evaluate).toBe(false)
    expect(s.files.exclude).toBeNull()
    expect(s.files.rmout).toBeNull()
    expect(s.files.cds?.name).toBe('genome.cds.fa')
  })

  it('exclude and rmout require Annotation', () => {
    const off = initialEdtaState()
    expect(isFileEnabled(off, 'exclude')).toBe(false)
    expect(isFileEnabled(off, 'rmout')).toBe(false)
    expect(isFileEnabled(off, 'cds')).toBe(true)
    expect(setExtraFile(off, 'exclude', file('a.bed'))).toBe(off)
    const on = setSwitch(off, 'anno', true)
    expect(isFileEnabled(on, 'exclude')).toBe(true)
  })
})

describe('step rules', () => {
  it('step "all" forgets the previous run', () => {
    let s = setStep(initialEdtaState(), 'final')
    s = { ...s, previousRunId: 'genome_20260101-000000' }
    expect(setStep(s, 'anno').previousRunId).toBe('genome_20260101-000000')
    expect(setStep(s, 'all').previousRunId).toBeNull()
  })
})

describe('value validators', () => {
  it.each(['1.3e-8', '1e-8', '7.0e-9', '0.000000013', '2E-9', '.5'])(
    'accepts mutation rate %s',
    (v) => {
      expect(validateMutationRate(v)).toBeNull()
    },
  )
  it.each(['abc', '-1e-8', '0', '1.3e', '1,3e-8'])('rejects mutation rate %s', (v) => {
    expect(validateMutationRate(v)).not.toBeNull()
  })
  it('accepts an empty mutation rate (pipeline default)', () => {
    expect(validateMutationRate('')).toBeNull()
  })
  it.each(['0', '40', '100'])('accepts max divergence %s', (v) => {
    expect(validateMaxDiv(v)).toBeNull()
  })
  it.each(['', '40.5', '-1', '101', 'x'])('rejects max divergence "%s" (integer only)', (v) => {
    expect(validateMaxDiv(v)).not.toBeNull()
  })
})

describe('validateEdta', () => {
  it('requires a genome for step "all"', () => {
    expect(validateEdta(initialEdtaState()).genome).toBeDefined()
    expect(validateEdta(valid())).toEqual({})
  })

  it('rejects genome extensions outside the legacy list', () => {
    const s = { ...initialEdtaState(), genome: file('genome.txt') }
    expect(validateEdta(s).genome).toMatch(/Accepted extensions/)
  })

  it('rejects file names starting with "-" (same rule as the server)', () => {
    const s = { ...initialEdtaState(), genome: file('-chr.fa') }
    expect(validateEdta(s).genome).toMatch(/cannot start with '-'/)
  })

  it('reusing a run requires the run but not the genome', () => {
    const s = setStep(initialEdtaState(), 'filter')
    expect(validateEdta(s)).toEqual({ previousRunId: expect.any(String) })
    expect(validateEdta({ ...s, previousRunId: 'x_20260101-000000' })).toEqual({})
  })

  it('threads must be an integer ≥ 10 (no silent fix)', () => {
    expect(validateEdta({ ...valid(), threads: '4' }).threads).toBeDefined()
    expect(validateEdta({ ...valid(), threads: '' }).threads).toBeDefined()
    expect(validateEdta({ ...valid(), threads: '12' }).threads).toBeUndefined()
  })

  it('validates email and extra file extensions', () => {
    expect(validateEdta({ ...valid(), email: 'nope' }).email).toBeDefined()
    expect(validateEdta({ ...valid(), email: 'a@b.org' }).email).toBeUndefined()
    const s = setSwitch(valid(), 'anno', true)
    expect(validateEdta(setExtraFile(s, 'exclude', file('x.txt')))['files.exclude']).toBeDefined()
    expect(validateEdta(setExtraFile(s, 'rmout', file('x.out')))['files.rmout']).toBeUndefined()
  })
})

describe('toEdtaRunConfig', () => {
  it('omits pipeline defaults (mutation rate 1.3e-8, max div 40)', () => {
    const cfg = toEdtaRunConfig({ ...valid(), mutationRate: '1.3e-8' })
    expect(cfg.mutationRate).toBeNull()
    expect(cfg.maxDiv).toBeNull()
    expect(cfg.threads).toBe(10)
    expect(cfg.email).toBeNull()
  })

  it('keeps non-default values', () => {
    const cfg = toEdtaRunConfig({ ...valid(), mutationRate: '7e-9', maxDiv: '30', threads: '20' })
    expect(cfg).toMatchObject({ mutationRate: '7e-9', maxDiv: 30, threads: 20 })
  })

  it('throws when the form is invalid', () => {
    expect(() => toEdtaRunConfig(initialEdtaState())).toThrow()
  })
})

describe('panEDTA rules', () => {
  it('adds rows; the first row cannot be removed', () => {
    let s = addPanPair(addPanPair(initialPanState()))
    expect(s.pairs).toHaveLength(3)
    const [first, second] = s.pairs
    expect(removePanPair(s, first.id)).toBe(s)
    s = removePanPair(s, second.id)
    expect(s.pairs).toHaveLength(2)
    expect(s.pairs[0].id).toBe(first.id)
  })

  it('requires at least one genome and the general CDS', () => {
    const errors = validatePan(initialPanState())
    expect(errors.pairs).toBeDefined()
    expect(errors.cds).toBeDefined()
  })

  it('accepts many genomes, each with an optional CDS', () => {
    let s: PanFormState = { ...initialPanState(), cds: file('genome.cds.fa') }
    s = addPanPair(addPanPair(s))
    s = setPanPairFile(s, s.pairs[0].id, 'genome', file('Ler.fa'))
    s = setPanPairFile(s, s.pairs[1].id, 'genome', file('Col.fa'))
    s = setPanPairFile(s, s.pairs[1].id, 'cds', file('Col.cds.fa'))
    s = setPanPairFile(s, s.pairs[2].id, 'genome', file('Aly.fa'))
    expect(validatePan(s)).toEqual({})
    const cfg = toPanRunConfig(s)
    expect(cfg.pairs.map((p) => [p.genome.name, p.cds?.name ?? null])).toEqual([
      ['Ler.fa', null],
      ['Col.fa', 'Col.cds.fa'],
      ['Aly.fa', null],
    ])
  })

  it('rejects a CDS without a genome in the same row (legacy pairing bug)', () => {
    let s: PanFormState = { ...initialPanState(), cds: file('g.cds.fa') }
    s = addPanPair(s)
    s = setPanPairFile(s, s.pairs[0].id, 'cds', file('orphan.cds.fa'))
    s = setPanPairFile(s, s.pairs[1].id, 'genome', file('Col.fa'))
    expect(validatePan(s)[`pairs.${s.pairs[0].id}.genome`]).toMatch(/needs a genome/)
  })

  it('rejects duplicate genome file names', () => {
    let s: PanFormState = { ...initialPanState(), cds: file('g.cds.fa') }
    s = addPanPair(s)
    s = setPanPairFile(s, s.pairs[0].id, 'genome', file('A.fa'))
    s = setPanPairFile(s, s.pairs[1].id, 'genome', file('A.fa'))
    expect(validatePan(s)[`pairs.${s.pairs[1].id}.genome`]).toMatch(/already in the list/)
  })

  it('threads ≥ 10 and full-length copies ≥ 3', () => {
    let s: PanFormState = { ...initialPanState(), cds: file('g.cds.fa') }
    s = setPanPairFile(s, s.pairs[0].id, 'genome', file('A.fa'))
    expect(validatePan({ ...s, copies: '2' }).copies).toBeDefined()
    expect(validatePan({ ...s, copies: '3' }).copies).toBeUndefined()
    expect(validatePan({ ...s, threads: '9' }).threads).toBeDefined()
  })
})
