import type { EdtaRunConfig, PanRunConfig, RunFile, RunSummary } from '../types'

export type RunEvent =
  /**
   * Log lines, in order. replace=true means "this is the whole log" (first event after
   * subscribing, or a reused run folder whose log.txt was restarted).
   */
  { type: 'log'; lines: string[]; replace?: boolean } | { type: 'status'; summary: RunSummary }

export interface EngineHealth {
  ok: boolean
  /** Short text for the status bar. */
  label: string
  /** False when the backend has no SMTP server, so e-mails are never sent. Null if unknown. */
  mailConfigured: boolean | null
}

/** Contract between the UI and the pipeline engine. */
export interface PipelineService {
  readonly kind: 'mock' | 'http'
  health(): Promise<EngineHealth>
  /** Validates on the "server" side and starts the run in background. Never waits for the pipeline. */
  startEdtaRun(cfg: EdtaRunConfig): Promise<{ runId: string }>
  startPanRun(cfg: PanRunConfig): Promise<{ runId: string }>
  listRuns(): Promise<RunSummary[]>
  getRun(runId: string): Promise<RunSummary>
  getLog(runId: string, tail?: number): Promise<string[]>
  /** Returns an unsubscribe function. */
  subscribeRun(runId: string, onEvent: (event: RunEvent) => void): () => void
  cancelRun(runId: string): Promise<void>
  /** Files used by the report view: run folder top level + REPORT/ (recursive). */
  listReportFiles(runId: string): Promise<RunFile[]>
  /** Text content of a file in the run folder. */
  readText(runId: string, path: string): Promise<string>
  /** URL of a file in the run folder; inline=true shows it in the browser instead of downloading. */
  fileUrl(runId: string, path: string, inline?: boolean): string
}

/** Error reported by the service. fieldErrors maps form fields to messages. */
export class ServiceError extends Error {
  readonly fieldErrors: Record<string, string>

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ServiceError'
    this.fieldErrors = fieldErrors
  }
}
