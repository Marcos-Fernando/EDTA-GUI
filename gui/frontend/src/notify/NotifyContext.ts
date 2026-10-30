import { createContext, useContext } from 'react'
import type { Notice } from './notices'

export interface NotifyValue {
  notices: Notice[]
  /** Prefix for document.title ("● Running · ", "✓ Finished · " …), or ''. */
  titlePrefix: string
  /** Called right after the server accepted a new run. */
  runStarted: (runId: string) => void
  dismiss: (id: string) => void
}

export const NotifyContext = createContext<NotifyValue | null>(null)

export function useNotify(): NotifyValue {
  const value = useContext(NotifyContext)
  if (!value) throw new Error('useNotify must be used inside <NotifyProvider>')
  return value
}
