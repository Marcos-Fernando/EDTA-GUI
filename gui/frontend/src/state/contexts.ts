import { createContext, type Dispatch } from 'react'
import type { Action, AppState } from './appState'
import type { PipelineService } from '../services'

export const StateContext = createContext<AppState | null>(null)
export const DispatchContext = createContext<Dispatch<Action> | null>(null)
export const ServiceContext = createContext<PipelineService | null>(null)
