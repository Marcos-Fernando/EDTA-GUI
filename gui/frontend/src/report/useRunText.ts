import { useEffect, useState } from 'react'
import { usePipelineService } from '../state/hooks'

export type TextState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; text: string }

/** Reads a text file of the run folder; path=null does nothing (section without data). */
export function useRunText(runId: string, path: string | null): TextState {
  const service = usePipelineService()
  const [state, setState] = useState<{ key: string; value: TextState } | null>(null)
  const key = `${runId}\n${path}`

  useEffect(() => {
    if (!path) return
    let cancelled = false
    service
      .readText(runId, path)
      .then((text) => !cancelled && setState({ key, value: { status: 'ready', text } }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState({
            key,
            value: { status: 'error', message: e instanceof Error ? e.message : String(e) },
          }),
      )
    return () => {
      cancelled = true
    }
  }, [service, runId, path, key])

  return state?.key === key ? state.value : { status: 'loading' }
}
