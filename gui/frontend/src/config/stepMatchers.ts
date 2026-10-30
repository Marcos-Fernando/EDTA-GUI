/**
 * Timeline steps detected from the real log messages printed by
 * EDTA.pl (root and AnnoTEP/EDTA), the AnnoTEP report script and panEDTA.sh.
 * Messages verified against the pipeline scripts.
 *
 * Lines start with the output of `date` (locale dependent), so patterns only
 * match the message text and are never anchored to the start of the line.
 */
import type { RunKind, Step, StepState, TimelineContext } from '../types'

export interface StepDef {
  id: string
  title: string
  description: string
  /** Any match marks the step as started. */
  start: readonly RegExp[]
  /** Any match marks the step as done (a later step starting also does). */
  end?: readonly RegExp[]
  /** Whether the step belongs to a run with this context. */
  when: (ctx: TimelineContext) => boolean
  /** Whether the step is skipped (not run) for this context, e.g. --step final. */
  skippedWhen?: (ctx: TimelineContext) => boolean
}

const isEdtaLike = (k: RunKind) => k === 'edta' || k === 'annotep' || k === 'unknown'
const stepIndex: Record<Step, number> = { all: 0, filter: 1, final: 2, anno: 3 }
/** EDTA.pl does `goto uc $step`: sections before the chosen step are not run. */
const startsAfter = (ctx: TimelineContext, section: Step) =>
  stepIndex[ctx.step] > stepIndex[section]

export const EDTA_STEPS: readonly StepDef[] = [
  {
    id: 'deps',
    title: 'Dependency check',
    description: 'Checks the scripts and programs required by the pipeline.',
    start: [/Dependency checking:/],
    end: [/All passed!/],
    when: (c) => isEdtaLike(c.kind),
  },
  {
    id: 'raw',
    title: 'Raw TE libraries',
    description: 'Structure-based discovery of LTR, SINE, LINE, TIR and Helitron candidates.',
    start: [/Obtain raw TE libraries using various structure-based programs/],
    end: [/Obtain raw TE libraries finished\./],
    when: (c) => isEdtaLike(c.kind),
    skippedWhen: (c) => startsAfter(c, 'all'),
  },
  {
    id: 'filter',
    title: 'Advanced filtering',
    description: 'Filters raw candidates and generates the stage 1 library.',
    start: [/Perform EDTA advance filtering for raw TE candidates/],
    end: [/EDTA advance filtering finished\./],
    when: (c) => isEdtaLike(c.kind),
    skippedWhen: (c) => startsAfter(c, 'filter'),
  },
  {
    id: 'final',
    title: 'Final TE library',
    description: 'Builds the non-redundant comprehensive TE library.',
    start: [/Perform EDTA final steps to generate a non-redundant comprehensive TE library/],
    end: [/EDTA final stage finished!/],
    when: (c) => isEdtaLike(c.kind),
    skippedWhen: (c) => startsAfter(c, 'final'),
  },
  {
    id: 'anno',
    title: 'Whole-genome annotation',
    description: 'Homology-based annotation of the genome with the TE library.',
    start: [/Perform post-EDTA analysis for whole-genome annotation:/],
    end: [/TE annotation using the EDTA library has finished!/],
    when: (c) => isEdtaLike(c.kind) && c.anno,
  },
  {
    id: 'lai',
    title: 'LAI assessment',
    description: 'Computes the LTR Assembly Index (AnnoTEP only).',
    start: [/Performing LAI:/, /A LAI result file .* is provided!/],
    end: [/TE annotation using the EDTA library has finished!/],
    when: (c) => (c.kind === 'annotep' || c.kind === 'unknown') && c.anno && c.runLai,
  },
  {
    id: 'evaluate',
    title: 'Annotation evaluation',
    description: 'Evaluates the consistency of the whole-genome TE annotation.',
    start: [/Evaluate the level of inconsistency for whole-genome TE annotation:/],
    end: [/Evaluation of TE annotation finished!/],
    when: (c) => isEdtaLike(c.kind) && c.anno && c.evaluate,
  },
  {
    id: 'reports',
    title: 'Charts and reports',
    description: 'Repeat landscape, LTR age, LTR phylogeny and TE reports in REPORT/.',
    start: [/Starting report and chart generation/, /Starting adapted ProcessRepeats/],
    end: [/The generation of charts and reports has been completed/],
    when: (c) => c.kind === 'annotep' || c.kind === 'unknown',
  },
]

export const PAN_STEPS: readonly StepDef[] = [
  {
    id: 'pan-start',
    title: 'panEDTA start',
    description: 'Checks the genome list, CDS and parameters.',
    start: [/Pan-genome Extensive de-novo TE Annotator \(panEDTA\)/],
    when: (c) => c.kind === 'pan',
  },
  {
    id: 'pan-edta',
    title: 'Individual EDTA annotations',
    description: 'Annotates each genome with EDTA (or reuses an existing annotation).',
    start: [
      /De novo annotate genome .* with EDTA/,
      /Existing EDTA annotation found in the directory of/,
    ],
    when: (c) => c.kind === 'pan',
  },
  {
    id: 'pan-fl',
    title: 'Full-length TEs',
    description: 'Keeps TE families with the minimum number of full-length copies per genome.',
    // "Idenfity" is the spelling printed by panEDTA.sh.
    start: [/(?:Idenfity|Identify) full-length TEs for genome/],
    when: (c) => c.kind === 'pan',
  },
  {
    id: 'pan-candidates',
    title: 'Pan-TE candidates',
    description: 'Extracts pan-TE library candidate sequences.',
    start: [/Extract pan-TE library candidate sequences/],
    when: (c) => c.kind === 'pan',
  },
  {
    id: 'pan-library',
    title: 'panEDTA library',
    description: 'Generates the non-redundant panEDTA library.',
    start: [/Generate the panEDTA library/],
    end: [/panEDTA library of .* is generated/],
    when: (c) => c.kind === 'pan',
  },
  {
    id: 'pan-reanno',
    title: 'Re-annotation',
    description: 'Re-annotates every genome with the panEDTA library.',
    start: [/Reannotate genome .* with the panEDTA library/],
    end: [/panEDTA annotation of .* is finished!/],
    when: (c) => c.kind === 'pan',
  },
]

/** The message that proves a run really finished, per mode and options. */
export function expectedFinalMessage(ctx: TimelineContext): RegExp | null {
  switch (ctx.kind) {
    case 'pan':
      return /panEDTA annotation of .* is finished!/
    case 'annotep':
      return /The generation of charts and reports has been completed/
    case 'edta':
      if (!ctx.anno) return /EDTA final stage finished!/
      return ctx.evaluate
        ? /Evaluation of TE annotation finished!/
        : /TE annotation using the EDTA library has finished!/
    default:
      return null
  }
}

export function stepsFor(ctx: TimelineContext): StepDef[] {
  const pool = ctx.kind === 'pan' ? PAN_STEPS : EDTA_STEPS
  return pool.filter((s) => s.when(ctx))
}

export interface DetectedStep {
  def: StepDef
  state: StepState
}

export interface Detection {
  steps: DetectedStep[]
  /** False when no message matched at all: the UI then shows only the log. */
  anyMatch: boolean
  current: DetectedStep | null
}

/**
 * Applies the step matchers to the log.
 * A step is done when its end message appears or a later step starts;
 * running when it started and is not done. When the run ended, a step that
 * was still running becomes failed (status failed) or done (completed).
 */
export function detectSteps(
  ctx: TimelineContext,
  lines: readonly string[],
  runStatus: 'running' | 'completed' | 'failed' | 'idle',
): Detection {
  const defs = stepsFor(ctx)
  const started = defs.map((d) => lines.some((l) => d.start.some((re) => re.test(l))))
  const ended = defs.map((d) => !!d.end && lines.some((l) => d.end!.some((re) => re.test(l))))
  const anyMatch = started.some(Boolean)
  // For unknown (legacy) runs, keep only steps that actually appear in the log.
  const keep = defs.map((_, i) => ctx.kind !== 'unknown' || started[i])

  const steps: DetectedStep[] = []
  defs.forEach((def, i) => {
    if (!keep[i]) return
    const laterStarted = started.some((s, j) => j > i && s)
    let state: StepState = 'pending'
    if (def.skippedWhen?.(ctx) && !started[i]) state = 'skipped'
    else if (ended[i] || (started[i] && laterStarted)) state = 'done'
    else if (started[i]) state = 'running'
    if (state === 'running' && runStatus === 'failed') state = 'failed'
    if (state === 'running' && runStatus === 'completed') state = 'done'
    steps.push({ def, state })
  })

  const current = steps.find((s) => s.state === 'running' || s.state === 'failed') ?? null
  return { steps, anyMatch, current }
}
