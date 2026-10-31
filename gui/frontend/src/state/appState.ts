import type {
  EdtaFormState,
  ExtraFileKey,
  PanFormState,
  PipelineMode,
  Species,
  Step,
  SwitchKey,
} from '../types'
import {
  addPanPair,
  applyMode,
  initialEdtaState,
  initialPanState,
  removePanPair,
  setExtraFile,
  setPanPairFile,
  setStep,
  setSwitch,
} from '../config/rules'

export type Theme = 'light' | 'dark'
export type RunPage = 'edta' | 'pan'

export interface AppState {
  theme: Theme
  edta: EdtaFormState
  pan: PanFormState
  /** Run followed by the workspace of each page. */
  activeRun: Record<RunPage, string | null>
  /** Incremented at every start: a continued run keeps its id but needs a new subscription. */
  runSeq: Record<RunPage, number>
}

export type Action =
  | { type: 'theme/set'; theme: Theme }
  | { type: 'edta/mode'; mode: PipelineMode }
  | {
      type: 'edta/text'
      field: 'email' | 'runName' | 'mutationRate' | 'maxDiv' | 'threads'
      value: string
    }
  | { type: 'edta/genome'; file: File | null }
  | { type: 'edta/species'; value: Species }
  | { type: 'edta/step'; value: Step }
  | { type: 'edta/previousRun'; runId: string | null }
  | { type: 'edta/switch'; key: SwitchKey; value: boolean }
  | { type: 'edta/file'; key: ExtraFileKey; file: File | null }
  | { type: 'edta/replace'; state: EdtaFormState }
  | { type: 'pan/text'; field: 'email' | 'threads' | 'copies'; value: string }
  | { type: 'pan/addPair' }
  | { type: 'pan/removePair'; id: string }
  | { type: 'pan/pairFile'; id: string; field: 'genome' | 'cds'; file: File | null }
  | { type: 'pan/file'; field: 'cds' | 'library'; file: File | null }
  | { type: 'pan/replace'; state: PanFormState }
  | { type: 'run/active'; page: RunPage; runId: string | null }

export function initialAppState(theme: Theme): AppState {
  return {
    theme,
    edta: initialEdtaState(),
    pan: initialPanState(),
    activeRun: { edta: null, pan: null },
    runSeq: { edta: 0, pan: 0 },
  }
}

export function appReducer(state: AppState, action: Action): AppState {
  const edta = (next: EdtaFormState) => (next === state.edta ? state : { ...state, edta: next })
  const pan = (next: PanFormState) => (next === state.pan ? state : { ...state, pan: next })

  switch (action.type) {
    case 'theme/set':
      return { ...state, theme: action.theme }
    case 'edta/mode':
      return edta(applyMode(state.edta, action.mode))
    case 'edta/text':
      return edta({ ...state.edta, [action.field]: action.value })
    case 'edta/genome':
      return edta({ ...state.edta, genome: action.file })
    case 'edta/species':
      return edta({ ...state.edta, species: action.value })
    case 'edta/step':
      return edta(setStep(state.edta, action.value))
    case 'edta/previousRun':
      return edta({ ...state.edta, previousRunId: action.runId })
    case 'edta/switch':
      return edta(setSwitch(state.edta, action.key, action.value))
    case 'edta/file':
      return edta(setExtraFile(state.edta, action.key, action.file))
    case 'edta/replace':
      return edta(action.state)
    case 'pan/text':
      return pan({ ...state.pan, [action.field]: action.value })
    case 'pan/addPair':
      return pan(addPanPair(state.pan))
    case 'pan/removePair':
      return pan(removePanPair(state.pan, action.id))
    case 'pan/pairFile':
      return pan(setPanPairFile(state.pan, action.id, action.field, action.file))
    case 'pan/file':
      return pan({ ...state.pan, [action.field]: action.file })
    case 'pan/replace':
      return pan(action.state)
    case 'run/active':
      return {
        ...state,
        activeRun: { ...state.activeRun, [action.page]: action.runId },
        runSeq: { ...state.runSeq, [action.page]: state.runSeq[action.page] + 1 },
      }
  }
}
