import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { appReducer, initialAppState } from './appState'
import { loadTheme } from './theme'
import { DispatchContext, ServiceContext, StateContext } from './contexts'
import { createPipelineService, type PipelineService } from '../services'
import { NotifyProvider } from '../notify/NotifyProvider'

interface Props {
  children: ReactNode
  /** Injected in tests. */
  service?: PipelineService
  /** Injected in tests: how often runs are checked for the start/end notices. */
  notifyIntervalMs?: number
}

export function AppProvider({ children, service, notifyIntervalMs }: Props) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initialAppState(loadTheme()))
  const [svc] = useState<PipelineService>(() => service ?? createPipelineService())

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  return (
    <ServiceContext.Provider value={svc}>
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={dispatch}>
          <NotifyProvider intervalMs={notifyIntervalMs}>{children}</NotifyProvider>
        </DispatchContext.Provider>
      </StateContext.Provider>
    </ServiceContext.Provider>
  )
}
