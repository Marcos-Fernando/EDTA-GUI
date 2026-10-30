import { useEffect, useState } from 'react'
import type { RunSummary } from '../types'
import { usePipelineService } from '../state/hooks'

export interface RunStream {
  summary: RunSummary | null
  lines: string[]
}

const EMPTY: RunStream = { summary: null, lines: [] }

/** Follows one run: full log on subscribe, then appended lines and status changes. */
export function useRunStream(runId: string | null): RunStream {
  const service = usePipelineService()
  const [stream, setStream] = useState<RunStream & { runId: string | null }>({
    ...EMPTY,
    runId,
  })

  useEffect(() => {
    if (!runId) return
    return service.subscribeRun(runId, (event) => {
      setStream((prev) => {
        const base = prev.runId === runId ? prev : { ...EMPTY, runId }
        if (event.type === 'status') return { ...base, summary: event.summary }
        return { ...base, lines: event.replace ? event.lines : [...base.lines, ...event.lines] }
      })
    })
  }, [service, runId])

  return stream.runId === runId && runId ? stream : EMPTY
}
