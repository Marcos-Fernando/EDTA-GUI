/**
 * Option rules and validation of the EDTA-GUI and panEDTA-GUI forms.
 * Pure functions: same input → same output, no DOM, easy to test.
 * Behaviour source: the legacy GUI.
 */
import type {
  EdtaFormState,
  EdtaRunConfig,
  ExtraFileKey,
  PanFormState,
  PanPair,
  PanRunConfig,
  PipelineMode,
  Step,
  SwitchKey,
} from '../types'
import { EXTRA_FILES, FASTA_EXTENSIONS, PARAMS, RUN_NAME, SWITCHES, TEST_RUN } from './edtaFields'
import { PAN_FILE_EXTENSIONS, PAN_PARAMS, PAN_TEST_RUN } from './panFields'
import { hasAllowedExtension } from '../utils/files'

export type FieldErrors = Record<string, string>

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const ALL_OFF: Record<SwitchKey, boolean> = {
  overwrite: false,
  sensitive: false,
  anno: false,
  evaluate: false,
  maker: false,
  force: false,
  tirFilter: false,
  annotType: false,
  runLai: false,
}

const NO_FILES: Record<ExtraFileKey, File | null> = {
  cds: null,
  curatedlib: null,
  exclude: null,
  rmlib: null,
  rmout: null,
}

/** In EDTA mode every switch starts off and what is shown is what is sent. */
export function initialEdtaState(): EdtaFormState {
  return {
    mode: 'edta',
    email: '',
    genome: null,
    runName: '',
    species: 'others',
    step: 'all',
    previousRunId: null,
    switches: { ...ALL_OFF },
    mutationRate: '',
    maxDiv: String(PARAMS.maxDiv.default),
    threads: String(PARAMS.threads.default),
    files: { ...NO_FILES },
  }
}

let pairSeq = 0
export function newPanPair(): PanPair {
  pairSeq += 1
  return { id: `pair-${pairSeq}`, genome: null, cds: null }
}

export function initialPanState(): PanFormState {
  return {
    email: '',
    pairs: [newPanPair()],
    cds: null,
    library: null,
    threads: String(PAN_PARAMS.threads.default),
    copies: String(PAN_PARAMS.copies.default),
  }
}

/* ------------------------------------------------------------------ */
/* EDTA-GUI option rules                                               */
/* ------------------------------------------------------------------ */

/** Switches forced on (and locked) in AnnoTEP mode. */
const ANNOTEP_LOCKED_ON: readonly SwitchKey[] = ['sensitive', 'anno']

export function isSwitchVisible(mode: PipelineMode, key: SwitchKey): boolean {
  return SWITCHES.find((s) => s.key === key)?.modes.includes(mode) ?? false
}

/** Why a switch is locked on, or null when it can be changed. */
export function switchLockReason(state: EdtaFormState, key: SwitchKey): string | null {
  if (state.mode === 'annotep' && ANNOTEP_LOCKED_ON.includes(key)) {
    return 'Always on in AnnoTEP mode'
  }
  // EDTA.pl --step anno only runs the annotation section, which needs --anno 1:
  // without it the run ends right after the dependency check.
  if (key === 'anno' && state.step === 'anno') return 'Always on with step "anno"'
  return null
}

export function isSwitchLocked(state: EdtaFormState, key: SwitchKey): boolean {
  return switchLockReason(state, key) !== null
}

/** Why a file input is disabled, or null when it is enabled. */
export function fileDisabledReason(state: EdtaFormState, key: ExtraFileKey): string | null {
  const def = EXTRA_FILES.find((f) => f.key === key)
  if (def?.requiresAnno && !state.switches.anno) return 'Enable "Annotation" to use this file.'
  if (def?.requiresMaker && state.mode === 'edta' && !state.switches.maker) {
    return 'Enable "MAKER mask" to use this file.'
  }
  return null
}

export function isFileEnabled(state: EdtaFormState, key: ExtraFileKey): boolean {
  return fileDisabledReason(state, key) === null
}

/** Clears the files that are no longer enabled. */
function withDisabledFilesCleared(state: EdtaFormState): EdtaFormState {
  const files = { ...state.files }
  for (const f of EXTRA_FILES) if (!isFileEnabled(state, f.key)) files[f.key] = null
  return { ...state, files }
}

/** Annotation off → Evaluate and MAKER mask off, exclude/rmout cleared. */
function withAnnoOff(state: EdtaFormState): EdtaFormState {
  return withDisabledFilesCleared({
    ...state,
    switches: { ...state.switches, anno: false, evaluate: false, maker: false },
  })
}

/**
 * Mode change.
 * - AnnoTEP: Sensitivity and Annotation on and locked; Run LAI on.
 * - EDTA: Sensitivity and Annotation back to 0 (1 only exists in AnnoTEP);
 *   AnnoTEP-only switches off and hidden.
 * MAKER mask exists only in EDTA mode.
 */
export function applyMode(state: EdtaFormState, mode: PipelineMode): EdtaFormState {
  if (mode === state.mode) return state
  if (mode === 'annotep') {
    return {
      ...state,
      mode,
      switches: { ...state.switches, sensitive: true, anno: true, runLai: true, maker: false },
    }
  }
  const reset: EdtaFormState = {
    ...state,
    mode,
    switches: {
      ...state.switches,
      sensitive: false,
      tirFilter: false,
      annotType: false,
      runLai: false,
    },
  }
  const edta = withAnnoOff(reset)
  return state.step === 'anno' ? { ...edta, switches: { ...edta.switches, anno: true } } : edta
}

/**
 * Evaluate or MAKER mask on → Annotation on; Annotation off → Evaluate and MAKER mask off
 * and annotation files cleared; MAKER mask off → exclude cleared.
 */
export function setSwitch(state: EdtaFormState, key: SwitchKey, value: boolean): EdtaFormState {
  if (isSwitchLocked(state, key) || !isSwitchVisible(state.mode, key)) return state
  if (key === 'anno' && !value) return withAnnoOff(state)
  const switches = { ...state.switches, [key]: value }
  if ((key === 'evaluate' || key === 'maker') && value) switches.anno = true
  return withDisabledFilesCleared({ ...state, switches })
}

/** Back to step "all" forgets the previous run; step "anno" turns Annotation on. */
export function setStep(state: EdtaFormState, step: Step): EdtaFormState {
  const switches = step === 'anno' ? { ...state.switches, anno: true } : state.switches
  return { ...state, step, switches, previousRunId: step === 'all' ? null : state.previousRunId }
}

export function setExtraFile(
  state: EdtaFormState,
  key: ExtraFileKey,
  file: File | null,
): EdtaFormState {
  if (!isFileEnabled(state, key)) return state
  return { ...state, files: { ...state.files, [key]: file } }
}

/**
 * Form of the "Run test analysis" button: test genome, run name "Test_genome", step "all",
 * Sensitivity and Annotation on (Annotation gives the charts). Keeps the mode, e-mail and
 * threads; everything else back to the defaults.
 */
export function testEdtaState(state: EdtaFormState, genome: File): EdtaFormState {
  const base = initialEdtaState()
  const edta: EdtaFormState = {
    ...base,
    email: state.email,
    threads: state.threads,
    genome,
    runName: TEST_RUN.runName,
    switches: { ...base.switches, sensitive: true, anno: true },
  }
  return applyMode(edta, state.mode)
}

/* ------------------------------------------------------------------ */
/* Value validators (shared by both pages and by the mock "server")    */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const POSITIVE_FLOAT_RE = /^(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i
const INT_RE = /^\d+$/

export function validateEmail(value: string): string | null {
  const v = value.trim()
  return v === '' || EMAIL_RE.test(v) ? null : 'Enter a valid email address, or leave it empty.'
}

/** Any positive number, decimal or scientific (1e-8, 1.3e-8, 0.000000013). */
export function validateMutationRate(value: string): string | null {
  const v = value.trim()
  if (v === '') return null
  if (!POSITIVE_FLOAT_RE.test(v) || !(Number(v) > 0)) {
    return 'Enter a positive number, e.g. 1.3e-8.'
  }
  return null
}

/** EDTA.pl declares maxdiv=i: integer 0–100. */
export function validateMaxDiv(value: string): string | null {
  const v = value.trim()
  const { min, max } = PARAMS.maxDiv
  if (!INT_RE.test(v) || Number(v) < min || Number(v) > max) {
    return `Enter a whole number from ${min} to ${max}.`
  }
  return null
}

/** Optional run folder name (the date and time are always added). */
export function validateRunName(value: string): string | null {
  const v = value.trim()
  if (v === '') return null
  if (v.length > RUN_NAME.maxLength) return `Use at most ${RUN_NAME.maxLength} characters.`
  if (!RUN_NAME.pattern.test(v)) {
    return 'Use letters, numbers, ".", "_" or "-" (no spaces), starting with a letter or number.'
  }
  return null
}

export function validateMinInt(value: string, min: number): string | null {
  const v = value.trim()
  if (!INT_RE.test(v) || Number(v) < min) return `Enter a whole number of at least ${min}.`
  return null
}

export const LEADING_DASH = "File names cannot start with '-': rename the file."

/** Extension check, plus no leading '-' (same rule as the server). */
function extensionError(file: File | null, allowed: readonly string[]): string | null {
  if (!file) return null
  if (file.name.trim().startsWith('-')) return LEADING_DASH
  if (hasAllowedExtension(file.name, allowed)) return null
  return `Accepted extensions: ${allowed.join(' ')}`
}

/* ------------------------------------------------------------------ */
/* EDTA-GUI validation                                                 */
/* ------------------------------------------------------------------ */

export function validateEdta(state: EdtaFormState): FieldErrors {
  const errors: FieldErrors = {}
  const set = (k: string, msg: string | null) => {
    if (msg) errors[k] = msg
  }

  set('email', validateEmail(state.email))

  const reusing = state.step !== 'all'
  if (reusing && !state.previousRunId) {
    errors.previousRunId = 'Select the previous run to continue from.'
  }
  // When reusing a run, the genome copy already in its folder is used.
  if (!state.genome && !reusing) errors.genome = 'Select a genome FASTA file.'
  set('genome', extensionError(state.genome, FASTA_EXTENSIONS))
  // When reusing a run, its folder (and name) is kept.
  if (!reusing) set('runName', validateRunName(state.runName))

  set('mutationRate', validateMutationRate(state.mutationRate))
  set('maxDiv', validateMaxDiv(state.maxDiv))
  set('threads', validateMinInt(state.threads, PARAMS.threads.min))

  for (const f of EXTRA_FILES) {
    set(`files.${f.key}`, extensionError(state.files[f.key], f.extensions))
  }
  return errors
}

/** Converts a valid form into the config sent to the service. Throws if invalid. */
export function toEdtaRunConfig(state: EdtaFormState): EdtaRunConfig {
  const errors = validateEdta(state)
  if (Object.keys(errors).length > 0) throw new Error('Invalid EDTA form')

  const mu = state.mutationRate.trim()
  const maxDiv = Number(state.maxDiv.trim())
  const switches = { ...state.switches }
  for (const s of SWITCHES) if (!s.modes.includes(state.mode)) switches[s.key] = false

  return {
    mode: state.mode,
    email: state.email.trim() || null,
    genome: state.genome,
    runName: state.step === 'all' ? state.runName.trim() || null : null,
    species: state.species,
    step: state.step,
    previousRunId: state.step === 'all' ? null : state.previousRunId,
    switches,
    mutationRate: mu === '' || mu === PARAMS.mutationRate.default ? null : mu,
    maxDiv: maxDiv === PARAMS.maxDiv.default ? null : maxDiv,
    threads: Number(state.threads.trim()),
    files: { ...state.files },
  }
}

/* ------------------------------------------------------------------ */
/* panEDTA                                                             */
/* ------------------------------------------------------------------ */

export function addPanPair(state: PanFormState): PanFormState {
  return { ...state, pairs: [...state.pairs, newPanPair()] }
}

/** The first row cannot be removed (legacy). */
export function removePanPair(state: PanFormState, id: string): PanFormState {
  if (state.pairs[0]?.id === id) return state
  return { ...state, pairs: state.pairs.filter((p) => p.id !== id) }
}

export function setPanPairFile(
  state: PanFormState,
  id: string,
  field: 'genome' | 'cds',
  file: File | null,
): PanFormState {
  return {
    ...state,
    pairs: state.pairs.map((p) => (p.id === id ? { ...p, [field]: file } : p)),
  }
}

/** Names of the files used by the panEDTA test (each downloaded once). */
export function panTestFileNames(): string[] {
  const names = PAN_TEST_RUN.pairs.flatMap((p) => (p.cds ? [p.genome, p.cds] : [p.genome]))
  return [...new Set([...names, PAN_TEST_RUN.cds, PAN_TEST_RUN.library])]
}

/** Form of the panEDTA "Run test analysis" button. Keeps the e-mail and threads. */
export function testPanState(state: PanFormState, files: ReadonlyMap<string, File>): PanFormState {
  const file = (name: string) => {
    const f = files.get(name)
    if (!f) throw new Error(`Missing test file ${name}`)
    return f
  }
  return {
    ...state,
    pairs: PAN_TEST_RUN.pairs.map((p) => ({
      ...newPanPair(),
      genome: file(p.genome),
      cds: p.cds ? file(p.cds) : null,
    })),
    cds: file(PAN_TEST_RUN.cds),
    library: file(PAN_TEST_RUN.library),
    copies: String(PAN_PARAMS.copies.default),
  }
}

export function validatePan(state: PanFormState): FieldErrors {
  const errors: FieldErrors = {}
  const set = (k: string, msg: string | null) => {
    if (msg) errors[k] = msg
  }

  set('email', validateEmail(state.email))

  const seen = new Set<string>()
  let genomes = 0
  for (const pair of state.pairs) {
    if (pair.genome) {
      genomes += 1
      set(`pairs.${pair.id}.genome`, extensionError(pair.genome, PAN_FILE_EXTENSIONS))
      if (seen.has(pair.genome.name)) {
        errors[`pairs.${pair.id}.genome`] = 'This genome file name is already in the list.'
      }
      seen.add(pair.genome.name)
    } else if (pair.cds) {
      errors[`pairs.${pair.id}.genome`] = 'A CDS file needs a genome in the same row.'
    }
    set(`pairs.${pair.id}.cds`, extensionError(pair.cds, PAN_FILE_EXTENSIONS))
  }
  if (genomes === 0) errors.pairs = 'Select at least one genome.'

  if (!state.cds) errors.cds = 'The coding DNA sequence (CDS) file is required.'
  set('cds', extensionError(state.cds, PAN_FILE_EXTENSIONS))
  set('library', extensionError(state.library, PAN_FILE_EXTENSIONS))
  set('threads', validateMinInt(state.threads, PAN_PARAMS.threads.min))
  set('copies', validateMinInt(state.copies, PAN_PARAMS.copies.min))
  return errors
}

export function toPanRunConfig(state: PanFormState): PanRunConfig {
  const errors = validatePan(state)
  if (Object.keys(errors).length > 0 || !state.cds) throw new Error('Invalid panEDTA form')
  return {
    email: state.email.trim() || null,
    pairs: state.pairs
      .filter((p): p is PanPair & { genome: File } => p.genome !== null)
      .map((p) => ({ id: p.id, genome: p.genome, cds: p.cds })),
    cds: state.cds,
    library: state.library,
    threads: Number(state.threads.trim()),
    copies: Number(state.copies.trim()),
  }
}
