import type { ExtraFileKey, PipelineMode, Species, Step, SwitchKey } from '../types'

/** FASTA extensions accepted by the legacy GUI (app.py → allowed_file). */
export const FASTA_EXTENSIONS = ['.fa', '.fasta', '.fna', '.ffn', '.faa', '.frn'] as const

export interface ModeDef {
  value: PipelineMode
  label: string
  title: string
  subtitle: string
  /** Pipeline script, relative to the repository root (shown in the command preview). */
  script: string
}

export const MODES: readonly ModeDef[] = [
  {
    value: 'edta',
    label: 'EDTA',
    title: 'EDTA-GUI',
    subtitle: 'The Extensive de novo TE Annotator',
    script: 'EDTA.pl',
  },
  {
    value: 'annotep',
    label: 'AnnoTEP',
    title: 'AnnoTEP',
    subtitle: 'Annotation of Transposable Elements in Plants',
    script: 'AnnoTEP/EDTA/EDTA.pl',
  },
]

/** AnnoTEP report script, run after EDTA.pl succeeds (bash, per its shebang). */
export const ANNOTEP_REPORT_SCRIPT = 'AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh'

/** EDTA charts script, run after EDTA.pl when Annotation is on (same REPORT/ folder). */
export const EDTA_REPORT_SCRIPT = 'AnnoTEP/Scripts/generate_PLOTs-for-EDTA.sh'

export const SPECIES_OPTIONS: readonly { value: Species; label: string }[] = [
  { value: 'others', label: 'others' },
  { value: 'rice', label: 'rice' },
  { value: 'maize', label: 'maize' },
]

export const STEP_OPTIONS: readonly { value: Step; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'filter', label: 'filter' },
  { value: 'final', label: 'final' },
  { value: 'anno', label: 'anno' },
]

export interface SwitchDef {
  key: SwitchKey
  label: string
  flag: string
  /** Only shown (and sent) in these modes. */
  modes: readonly PipelineMode[]
}

/** Order follows the legacy "TE Analysis Parameters" table. */
export const SWITCHES: readonly SwitchDef[] = [
  { key: 'overwrite', label: 'Overwrite', flag: '--overwrite', modes: ['edta', 'annotep'] },
  { key: 'sensitive', label: 'Sensitivity', flag: '--sensitive', modes: ['edta', 'annotep'] },
  { key: 'anno', label: 'Annotation', flag: '--anno', modes: ['edta', 'annotep'] },
  { key: 'evaluate', label: 'Evaluate', flag: '--evaluate', modes: ['edta', 'annotep'] },
  // --maker exists only in the root EDTA.pl (v2.3); AnnoTEP always writes MAKER.masked.
  { key: 'maker', label: 'MAKER mask', flag: '--maker', modes: ['edta'] },
  { key: 'force', label: 'Force', flag: '--force', modes: ['edta', 'annotep'] },
  { key: 'tirFilter', label: 'TIR filter', flag: '--TIR_filter', modes: ['annotep'] },
  { key: 'annotType', label: 'Annot. type', flag: '--ANNOT_TYPE', modes: ['annotep'] },
  { key: 'runLai', label: 'Run LAI', flag: '--run_LAI', modes: ['annotep'] },
]

export interface ExtraFileDef {
  key: ExtraFileKey
  label: string
  flag: string
  /** Empty = any extension. */
  extensions: readonly string[]
  placeholder: string
  /** Requires the Annotation switch. */
  requiresAnno: boolean
  /** EDTA mode: also requires MAKER mask (the file only affects MAKER.masked). */
  requiresMaker: boolean
}

export const EXTRA_FILES: readonly ExtraFileDef[] = [
  {
    key: 'cds',
    label: 'Coding DNA sequence (cds)',
    flag: '--cds',
    extensions: FASTA_EXTENSIONS,
    placeholder: '.fasta .fa',
    requiresAnno: false,
    requiresMaker: false,
  },
  {
    key: 'curatedlib',
    label: 'Curated library (curatedlib)',
    flag: '--curatedlib',
    extensions: [],
    placeholder: 'none selected',
    requiresAnno: false,
    requiresMaker: false,
  },
  {
    key: 'exclude',
    label: 'Exclusion of masked regions (exclude)',
    flag: '--exclude',
    extensions: ['.bed'],
    placeholder: '.bed',
    requiresAnno: true,
    requiresMaker: true,
  },
  {
    key: 'rmlib',
    label: 'RepeatModeler library (rmlib)',
    flag: '--rmlib',
    extensions: [],
    placeholder: 'none selected',
    requiresAnno: false,
    requiresMaker: false,
  },
  {
    key: 'rmout',
    label: 'RepeatMasker library (rmout)',
    flag: '--rmout',
    extensions: ['.out'],
    placeholder: '.out',
    requiresAnno: true,
    requiresMaker: false,
  },
]

/** Run name: the new run folder is <name>_<YYYYmmdd-HHMMSS>; empty = genome name. */
export const RUN_NAME = {
  label: 'Run name',
  maxLength: 80,
  /** Same characters as the run folders (no spaces, no leading '.', '_' or '-'). */
  pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
} as const

/**
 * "Run test analysis" button: chromosome 1 of Arabidopsis thaliana (repository test/ folder,
 * downloaded from the server). Same genome in both modes, which both end with charts.
 */
export const TEST_RUN = {
  genome: 'TAIR10_chr1.fa',
  runName: 'Test_genome',
  /** Measured with 10 threads (fewer threads take longer). */
  duration: { edta: 'about 1 hour', annotep: 'about 1 h 20 min' },
} as const

/** Numeric parameters: defaults are omitted from the command, as in the legacy GUI. */
export const PARAMS = {
  mutationRate: {
    label: 'Mut. rate (-u)',
    title: 'Neutral mutation rate',
    flag: '--u',
    default: '1.3e-8',
  },
  maxDiv: {
    label: 'Max div. (%)',
    title: 'Maximum divergence (0–100)',
    flag: '--maxdiv',
    default: 40,
    min: 0,
    max: 100,
  },
  threads: {
    label: 'Threads',
    title: 'Number of threads (minimum 10)',
    flag: '--threads',
    default: 10,
    min: 10,
  },
} as const
