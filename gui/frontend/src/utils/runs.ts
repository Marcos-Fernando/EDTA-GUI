import type { RunSummary } from '../types'

/** Results order: running first, then most recent start (fixes legacy problem 8). */
export function sortRuns(runs: readonly RunSummary[]): RunSummary[] {
  const time = (r: RunSummary) => (r.startedAt ? new Date(r.startedAt).getTime() : 0)
  return [...runs].sort((a, b) => {
    const ra = a.status === 'running' ? 0 : 1
    const rb = b.status === 'running' ? 0 : 1
    return ra - rb || time(b) - time(a) || b.id.localeCompare(a.id)
  })
}

export type StatusTone = 'running' | 'ok' | 'error' | 'warn'

export interface StatusView {
  label: string
  tone: StatusTone
  /** Extra explanation, e.g. the missing final message warning. */
  note?: string
}

/** Text shown for a run status (status.txt content; "Annotating ..." while absent). */
export function statusView(
  run: Pick<RunSummary, 'status' | 'statusText' | 'finalMessageFound'> &
    Partial<Pick<RunSummary, 'queuePosition'>>,
): StatusView {
  if (run.status === 'running' && run.queuePosition && run.queuePosition > 0) {
    return {
      label: `Queued (#${run.queuePosition})`,
      tone: 'running',
      note: 'Waiting in the queue: this run starts right after the current one finishes.',
    }
  }
  if (run.status === 'running') return { label: 'Annotating ...', tone: 'running' }
  if (run.status === 'failed') {
    return { label: run.statusText ?? 'Error in the annotation step', tone: 'error' }
  }
  if (run.finalMessageFound === false) {
    return {
      label: run.statusText ?? 'Annotation finalised',
      tone: 'warn',
      note: 'Finished, but the expected final message was not found in the log. Check the log.',
    }
  }
  return { label: run.statusText ?? 'Annotation finalised', tone: 'ok' }
}

export const KIND_LABEL: Record<RunSummary['kind'], string> = {
  edta: 'EDTA',
  annotep: 'AnnoTEP',
  pan: 'panEDTA',
  unknown: '—',
}
