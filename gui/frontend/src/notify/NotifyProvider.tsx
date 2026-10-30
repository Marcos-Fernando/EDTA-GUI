import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RunSummary } from '../types'
import { hrefFor } from '../hooks/useHashRoute'
import { usePipelineService } from '../state/hooks'
import { NotifyContext, type NotifyValue } from './NotifyContext'
import { endNotice, endedRuns, startNotice, type Notice } from './notices'
import { playChime, showSystemNotification } from './system'

/** How often the run list is checked for runs that ended. */
export const WATCH_INTERVAL_MS = 5_000
/** Older notices are dropped so the stack never covers the page. */
const MAX_NOTICES = 3

interface Props {
  children: ReactNode
  /** Injected in tests. */
  intervalMs?: number
}

export function NotifyProvider({ children, intervalMs = WATCH_INTERVAL_MS }: Props) {
  const service = usePipelineService()
  const [notices, setNotices] = useState<Notice[]>([])
  const [running, setRunning] = useState(0)
  const known = useRef<Map<string, RunSummary['status']> | null>(null)
  const startedHere = useRef(new Set<string>())

  const push = useCallback((notice: Notice) => {
    setNotices((list) => [notice, ...list.filter((n) => n.id !== notice.id)].slice(0, MAX_NOTICES))
  }, [])

  const check = useCallback(() => {
    service.listRuns().then(
      (runs) => {
        const previous = known.current
        known.current = new Map(runs.map((r) => [r.id, r.status]))
        setRunning(runs.filter((r) => !r.readOnly && r.status === 'running').length)
        if (!previous) return // first look: remember, announce nothing
        for (const run of endedRuns(previous, runs, startedHere.current)) {
          startedHere.current.delete(run.id)
          const notice = endNotice(run)
          push(notice)
          playChime(notice.kind === 'finished')
          showSystemNotification(notice.title, notice.message, notice.id, () => {
            window.location.hash = hrefFor({ page: 'run', runId: run.id })
          })
        }
      },
      () => {}, // backend down: the status bar already says so
    )
  }, [service, push])

  useEffect(() => {
    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [check, intervalMs])

  const runStarted = useCallback(
    (runId: string) => {
      startedHere.current.add(runId)
      known.current?.set(runId, 'running')
      setRunning((n) => n + 1)
      playChime(true)
      // The queue position tells "started" from "waiting in line".
      service.getRun(runId).then(
        (run) => push(startNotice(runId, run.queuePosition)),
        () => push(startNotice(runId, null)),
      )
    },
    [service, push],
  )

  const dismiss = useCallback((id: string) => {
    setNotices((list) => list.filter((n) => n.id !== id))
  }, [])

  const titlePrefix = useMemo(() => {
    const ended = notices.find((n) => n.kind === 'finished' || n.kind === 'failed')
    if (ended) return ended.kind === 'finished' ? '✓ Finished · ' : '✗ Error · '
    return running > 0 ? '● Running · ' : ''
  }, [notices, running])

  const value = useMemo<NotifyValue>(
    () => ({ notices, titlePrefix, runStarted, dismiss }),
    [notices, titlePrefix, runStarted, dismiss],
  )
  return <NotifyContext.Provider value={value}>{children}</NotifyContext.Provider>
}
