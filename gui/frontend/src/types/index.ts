/** Pipeline used by the EDTA-GUI page. panEDTA always runs the EDTA engine. */
export type PipelineMode = 'edta' | 'annotep'

/** Kind of a run folder in results/. Legacy folders without metadata are 'unknown'. */
export type RunKind = PipelineMode | 'pan' | 'unknown'

export type Species = 'others' | 'rice' | 'maize'
export type Step = 'all' | 'filter' | 'final' | 'anno'

export type SwitchKey =
  | 'overwrite'
  | 'sensitive'
  | 'anno'
  | 'evaluate'
  | 'maker'
  | 'force'
  | 'tirFilter'
  | 'annotType'
  | 'runLai'

export type ExtraFileKey = 'cds' | 'curatedlib' | 'exclude' | 'rmlib' | 'rmout'

/** Raw form state of the EDTA-GUI page (numbers are kept as typed text). */
export interface EdtaFormState {
  mode: PipelineMode
  email: string
  genome: File | null
  /** Name of the new run folder (<name>_<date-time>); empty = genome name. */
  runName: string
  species: Species
  step: Step
  /** Run folder reused when step ≠ all. */
  previousRunId: string | null
  switches: Record<SwitchKey, boolean>
  mutationRate: string
  maxDiv: string
  threads: string
  files: Record<ExtraFileKey, File | null>
}

/** Validated configuration sent to the service. */
export interface EdtaRunConfig {
  mode: PipelineMode
  email: string | null
  /** May be null only when reusing a previous run (its genome copy is used). */
  genome: File | null
  /** null = genome name; always null when reusing a previous run. */
  runName: string | null
  species: Species
  step: Step
  previousRunId: string | null
  switches: Record<SwitchKey, boolean>
  /** null = pipeline default (flag omitted). */
  mutationRate: string | null
  /** null = pipeline default (flag omitted). */
  maxDiv: number | null
  threads: number
  files: Record<ExtraFileKey, File | null>
}

export interface PanPair {
  id: string
  genome: File | null
  cds: File | null
}

export interface PanFormState {
  email: string
  pairs: PanPair[]
  cds: File | null
  library: File | null
  threads: string
  copies: string
}

export interface PanRunConfig {
  email: string | null
  /** id = form row id, used to show server errors on the right row. */
  pairs: { id?: string; genome: File; cds: File | null }[]
  cds: File
  library: File | null
  threads: number
  copies: number
}

/** Derived from status.txt: absent → running. */
export type RunStatus = 'running' | 'completed' | 'failed'

export interface RunSummary {
  id: string
  kind: RunKind
  /** Genome file name stored in the run folder, when known. */
  genome: string | null
  startedAt: string | null
  finishedAt: string | null
  status: RunStatus
  /** Raw content of status.txt. */
  statusText: string | null
  /** Whether the expected final message appears in the log (null when unknown). */
  finalMessageFound: boolean | null
  /** Options that shape the timeline, when known. */
  options: TimelineContext | null
  lastLogLines: string[]
  /** Runs of the old results folder: listed, but cannot be continued or cancelled. */
  readOnly: boolean
  /** > 0 while waiting for a free slot in the backend queue. */
  queuePosition: number | null
  /** Absolute folder of the run on the backend machine (null when unknown). */
  path: string | null
}

/** A file inside a run folder (path relative to the folder, with forward slashes). */
export interface RunFile {
  path: string
  size: number
  modifiedAt: string
}

export type StepState = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export interface LogEntry {
  seq: number
  text: string
}

/** What determines which timeline steps exist for a run. */
export interface TimelineContext {
  kind: RunKind
  step: Step
  anno: boolean
  evaluate: boolean
  runLai: boolean
  /** EDTA runs with the charts step (REPORT/). Absent in runs from older versions. */
  charts?: boolean
}
