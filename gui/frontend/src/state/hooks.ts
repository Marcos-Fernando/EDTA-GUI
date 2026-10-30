import { useContext } from 'react'
import { DispatchContext, ServiceContext, StateContext } from './contexts'

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} must be used inside <AppProvider>`)
  return value
}

export const useAppState = () => required(useContext(StateContext), 'useAppState')
export const useAppDispatch = () => required(useContext(DispatchContext), 'useAppDispatch')
export const usePipelineService = () => required(useContext(ServiceContext), 'usePipelineService')
