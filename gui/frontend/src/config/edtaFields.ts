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
}

export const EXTRA_FILES: readonly ExtraFileDef[] = [
  {
    key: 'cds',
    label: 'Coding DNA sequence (cds)',
    flag: '--cds',
    extensions: FASTA_EXTENSIONS,
    placeholder: '.fasta .fa',
    requiresAnno: false,
  },
  {
    key: 'curatedlib',
    label: 'Curated library (curatedlib)',
    flag: '--curatedlib',
    extensions: [],
    placeholder: 'none selected',
    requiresAnno: false,
  },
  {
    key: 'exclude',
    label: 'Exclusion of masked regions (exclude)',
    flag: '--exclude',
    extensions: ['.bed'],
    placeholder: '.bed',
    requiresAnno: true,
  },
  {
    key: 'rmlib',
    label: 'RepeatModeler library (rmlib)',
    flag: '--rmlib',
    extensions: [],
    placeholder: 'none selected',
    requiresAnno: false,
  },
  {
    key: 'rmout',
    label: 'RepeatMasker library (rmout)',
    flag: '--rmout',
    extensions: ['.out'],
    placeholder: '.out',
    requiresAnno: true,
  },
]

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
