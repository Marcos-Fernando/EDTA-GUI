import { describe, expect, it } from 'vitest'
import type { TimelineContext } from '../types'
import { detectSteps, expectedFinalMessage, stepsFor } from './stepMatchers'

const ctx = (over: Partial<TimelineContext> = {}): TimelineContext => ({
  kind: 'edta',
  step: 'all',
  anno: false,
  evaluate: false,
  runLai: false,
  ...over,
})

// Lines in the real format: `date` output, a tab, the message.
const D = 'Tue Oct  6 11:02:03 -03 2026\t'

describe('stepsFor', () => {
  it('EDTA without annotation: dependency, raw, filter, final', () => {
    expect(stepsFor(ctx()).map((s) => s.id)).toEqual(['deps', 'raw', 'filter', 'final'])
  })

  it('EDTA with annotation and evaluation', () => {
    expect(stepsFor(ctx({ anno: true, evaluate: true })).map((s) => s.id)).toEqual([
      'deps',
      'raw',
      'filter',
      'final',
      'anno',
      'evaluate',
    ])
  })

  it('AnnoTEP adds LAI (when enabled) and reports', () => {
    const ids = stepsFor(ctx({ kind: 'annotep', anno: true, runLai: true })).map((s) => s.id)
    expect(ids).toEqual(['deps', 'raw', 'filter', 'final', 'anno', 'lai', 'reports'])
    const noLai = stepsFor(ctx({ kind: 'annotep', anno: true })).map((s) => s.id)
    expect(noLai).not.toContain('lai')
  })

  it('panEDTA uses its own steps', () => {
    expect(stepsFor(ctx({ kind: 'pan' })).map((s) => s.id)).toEqual([
      'pan-start',
      'pan-edta',
      'pan-fl',
      'pan-candidates',
      'pan-library',
      'pan-reanno',
    ])
  })
})

describe('detectSteps', () => {
  it('marks done / running / pending from real messages', () => {
    const lines = [
      `${D}Dependency checking:`,
      '\tAll passed!',
      `${D}Obtain raw TE libraries using various structure-based programs: `,
      `${D}Obtain raw TE libraries finished.`,
      `${D}Perform EDTA advance filtering for raw TE candidates and generate the stage 1 library: `,
    ]
    const d = detectSteps(ctx(), lines, 'running')
    expect(d.steps.map((s) => s.state)).toEqual(['done', 'done', 'running', 'pending'])
    expect(d.current?.def.id).toBe('filter')
    expect(d.anyMatch).toBe(true)
  })

  it('a step is done when a later step starts even without its end message', () => {
    const lines = [
      `${D}Dependency checking:`,
      `${D}Perform EDTA final steps to generate a non-redundant comprehensive TE library.`,
    ]
    const d = detectSteps(ctx({ step: 'final' }), lines, 'running')
    expect(d.steps.find((s) => s.def.id === 'deps')?.state).toBe('done')
  })

  it('steps before --step are skipped', () => {
    const d = detectSteps(ctx({ step: 'final' }), [], 'running')
    expect(d.steps.map((s) => [s.def.id, s.state])).toEqual([
      ['deps', 'pending'],
      ['raw', 'skipped'],
      ['filter', 'skipped'],
      ['final', 'pending'],
    ])
  })

  it('the running step becomes failed when the run fails', () => {
    const lines = [
      `${D}Dependency checking:`,
      '\tAll passed!',
      `${D}Obtain raw TE libraries using various structure-based programs: `,
    ]
    const d = detectSteps(ctx(), lines, 'failed')
    expect(d.steps.find((s) => s.def.id === 'raw')?.state).toBe('failed')
    expect(d.current?.def.id).toBe('raw')
  })

  it('reports no match for logs without known messages', () => {
    const d = detectSteps(ctx(), ['Test file'], 'completed')
    expect(d.anyMatch).toBe(false)
  })

  it('unknown (legacy) runs keep only the steps found in the log', () => {
    const lines = [
      `${D}Dependency checking:`,
      'The generation of charts and reports has been completed',
    ]
    const unknown = {
      kind: 'unknown',
      step: 'all',
      anno: true,
      evaluate: true,
      runLai: true,
    } as const
    const d = detectSteps(unknown, lines, 'completed')
    expect(d.steps.map((s) => s.def.id)).toEqual(['deps'])
  })

  it('panEDTA: matches the "Idenfity" spelling printed by the script', () => {
    const lines = [
      'Pan-genome Extensive de-novo TE Annotator (panEDTA)',
      'De novo annotate genome Ler.fa with EDTA',
      '\tIdenfity full-length TEs for genome Ler.fa',
    ]
    const d = detectSteps(ctx({ kind: 'pan' }), lines, 'running')
    expect(d.current?.def.id).toBe('pan-fl')
  })
})

describe('expectedFinalMessage', () => {
  it('depends on the mode and options', () => {
    expect(expectedFinalMessage(ctx())?.test('EDTA final stage finished! You may check out:')).toBe(
      true,
    )
    expect(expectedFinalMessage(ctx({ anno: true }))?.source).toMatch(/TE annotation using/)
    expect(expectedFinalMessage(ctx({ anno: true, evaluate: true }))?.source).toMatch(/Evaluation/)
    expect(expectedFinalMessage(ctx({ kind: 'annotep' }))?.source).toMatch(/charts and reports/)
    expect(
      expectedFinalMessage(ctx({ kind: 'pan' }))?.test(
        'panEDTA annotation of genome_1.cds.list is finished!',
      ),
    ).toBe(true)
    expect(expectedFinalMessage(ctx({ kind: 'unknown' }))).toBeNull()
  })
})
