import type { RunSummary } from '../types'

export type NoticeKind = 'started' | 'queued' | 'finished' | 'failed'

export interface Notice {
  /** One notice per run and kind. */
  id: string
  kind: NoticeKind
  runId: string
  title: string
  message: string
}

/** Plain, short sentences: these messages must be easy to notice and understand. */
export function startNotice(runId: string, queuePosition: number | null): Notice {
  if (queuePosition && queuePosition > 0) {
    return {
      id: `${runId}:queued`,
      kind: 'queued',
      runId,
      title: 'Analysis is waiting in line',
      message: `${runId} will start by itself when the current analysis ends. You can leave this page open.`,
    }
  }
  return {
    id: `${runId}:started`,
    kind: 'started',
    runId,
    title: 'Analysis started',
    message: `${runId} is running. It can take several hours. A message like this one will appear here when it ends.`,
  }
}

export function endNotice(run: RunSummary): Notice {
  if (run.status === 'completed') {
    return {
      id: `${run.id}:finished`,
      kind: 'finished',
      runId: run.id,
      title: 'Analysis finished',
      message: `${run.id} finished successfully. The results are ready.`,
    }
  }
  return {
    id: `${run.id}:failed`,
    kind: 'failed',
    runId: run.id,
    title: 'Analysis stopped with an error',
    message: `${run.id} did not finish. Open it to see the log.`,
  }
}

type Known = ReadonlyMap<string, RunSummary['status']>

/**
 * Runs that ended since the previous poll. Only runs seen running before (or started in
 * this tab) count, so opening the page never announces old results.
 */
export function endedRuns(previous: Known, runs: RunSummary[], startedHere: ReadonlySet<string>) {
  return runs.filter(
    (r) =>
      !r.readOnly &&
      r.status !== 'running' &&
      (previous.get(r.id) === 'running' || (!previous.has(r.id) && startedHere.has(r.id))),
  )
}
