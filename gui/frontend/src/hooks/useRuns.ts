import { useCallback, useEffect, useState } from 'react'
import type { RunSummary } from '../types'
import { usePipelineService } from '../state/hooks'

/** Legacy Results page refreshed every 10 s. */
export const RESULTS_REFRESH_MS = 10_000

export interface RunsState {
  runs: RunSummary[] | null
  error: string | null
  refresh: () => void
}

export function useRuns(intervalMs: number | null = RESULTS_REFRESH_MS): RunsState {
  const service = usePipelineService()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    service.listRuns().then(
      (list) => {
        setRuns(list)
        setError(null)
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [service])

  useEffect(() => {
    refresh()
    if (intervalMs === null) return
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { runs, error, refresh }
}
