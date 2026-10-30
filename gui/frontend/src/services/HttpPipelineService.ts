/**
 * Client of the FastAPI backend.
 * Real-time updates use Server-Sent Events; the browser's EventSource reconnects by
 * itself and resumes the log with Last-Event-ID.
 */
import type { EdtaRunConfig, PanRunConfig, RunFile, RunSummary } from '../types'
import type { EngineHealth, PipelineService, RunEvent } from './PipelineService'
import { ServiceError } from './PipelineService'

type EventSourceFactory = (url: string) => EventSource

export interface HttpOptions {
  /** Backend origin; '' = same origin (Vite proxy in development, FastAPI in production). */
  baseUrl?: string
  fetchFn?: typeof fetch
  eventSource?: EventSourceFactory
}

interface ErrorBody {
  message?: string
  fieldErrors?: Record<string, string>
}

interface HealthBody {
  status: 'ok' | 'degraded'
  resultsDirWritable: boolean
  condaFound: boolean
  condaEnvs: Record<string, string>
  mailConfigured: boolean
}

/** Older backends (or partial objects) get safe defaults for the newer fields. */
function normalize(run: RunSummary): RunSummary {
  return {
    ...run,
    readOnly: run.readOnly ?? false,
    queuePosition: run.queuePosition ?? null,
    path: run.path ?? null,
  }
}

export class HttpPipelineService implements PipelineService {
  readonly kind = 'http' as const
  private readonly api: string
  private readonly fetchFn: typeof fetch
  private readonly eventSource: EventSourceFactory

  constructor(options: HttpOptions = {}) {
    const base = options.baseUrl ?? import.meta.env.VITE_API_BASE ?? ''
    this.api = `${base.replace(/\/$/, '')}/api`
    this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args))
    this.eventSource = options.eventSource ?? ((url) => new EventSource(url))
  }

  /* ------------------------------ helpers ------------------------------ */

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await this.fetchFn(`${this.api}${path}`, init)
    } catch {
      throw new ServiceError('Cannot reach the backend. Check that the server is running.')
    }
    if (!res.ok) {
      let body: ErrorBody = {}
      try {
        body = (await res.json()) as ErrorBody
      } catch {
        /* not JSON */
      }
      throw new ServiceError(
        body.message ?? `Request failed (${res.status}).`,
        body.fieldErrors ?? {},
      )
    }
    return (await res.json()) as T
  }

  /* ------------------------------ PipelineService ------------------------------ */

  async health(): Promise<EngineHealth> {
    try {
      const h = await this.request<HealthBody>('/health')
      if (h.status === 'ok') {
        return {
          ok: true,
          label: `${h.condaEnvs.edta} / ${h.condaEnvs.annotep}`,
          mailConfigured: h.mailConfigured,
        }
      }
      const problems = [
        !h.condaFound && 'conda not found',
        !h.resultsDirWritable && 'results folder not writable',
      ].filter(Boolean)
      return {
        ok: false,
        label: `backend degraded: ${problems.join(', ')}`,
        mailConfigured: h.mailConfigured,
      }
    } catch {
      return { ok: false, label: 'backend unreachable', mailConfigured: null }
    }
  }

  async startEdtaRun(cfg: EdtaRunConfig): Promise<{ runId: string }> {
    const form = new FormData()
    form.append(
      'config',
      JSON.stringify({
        mode: cfg.mode,
        email: cfg.email,
        species: cfg.species,
        step: cfg.step,
        previousRunId: cfg.previousRunId,
        switches: cfg.switches,
        mutationRate: cfg.mutationRate,
        maxDiv: cfg.maxDiv,
        threads: cfg.threads,
      }),
    )
    if (cfg.genome) form.append('genome', cfg.genome)
    for (const [key, file] of Object.entries(cfg.files)) {
      if (file) form.append(key, file)
    }
    return this.request('/runs/edta', { method: 'POST', body: form })
  }

  async startPanRun(cfg: PanRunConfig): Promise<{ runId: string }> {
    const form = new FormData()
    form.append(
      'config',
      JSON.stringify({
        email: cfg.email,
        threads: cfg.threads,
        copies: cfg.copies,
        pairs: cfg.pairs.length,
      }),
    )
    cfg.pairs.forEach((p, i) => {
      form.append(`pairs.${i}.genome`, p.genome)
      if (p.cds) form.append(`pairs.${i}.cds`, p.cds)
    })
    form.append('cds', cfg.cds)
    if (cfg.library) form.append('library', cfg.library)
    try {
      return await this.request('/runs/pan', { method: 'POST', body: form })
    } catch (e) {
      // The server reports rows by index; the form identifies them by row id.
      if (e instanceof ServiceError) {
        const mapped: Record<string, string> = {}
        for (const [key, msg] of Object.entries(e.fieldErrors)) {
          const m = /^pairs\.(\d+)\.(genome|cds)$/.exec(key)
          const id = m ? cfg.pairs[Number(m[1])]?.id : undefined
          mapped[m && id ? `pairs.${id}.${m[2]}` : key] = msg
        }
        throw new ServiceError(e.message, mapped)
      }
      throw e
    }
  }

  async listRuns(): Promise<RunSummary[]> {
    const runs = await this.request<RunSummary[]>('/runs')
    return runs.map(normalize)
  }

  async getRun(runId: string): Promise<RunSummary> {
    return normalize(await this.request<RunSummary>(`/runs/${encodeURIComponent(runId)}`))
  }

  async getLog(runId: string, tail?: number): Promise<string[]> {
    const q = tail ? `?tail=${tail}` : ''
    const body = await this.request<{ lines: string[] }>(
      `/runs/${encodeURIComponent(runId)}/log${q}`,
    )
    return body.lines
  }

  subscribeRun(runId: string, onEvent: (event: RunEvent) => void): () => void {
    const es = this.eventSource(`${this.api}/runs/${encodeURIComponent(runId)}/events`)
    const parse = (e: Event) => JSON.parse((e as MessageEvent<string>).data) as unknown

    es.addEventListener('log', (e) => {
      const d = parse(e) as { lines: string[]; replace?: boolean }
      onEvent({ type: 'log', lines: d.lines, replace: d.replace })
    })
    es.addEventListener('status', (e) => {
      onEvent({ type: 'status', summary: normalize(parse(e) as RunSummary) })
    })
    // The run ended: stop, otherwise EventSource would reconnect forever.
    es.addEventListener('end', () => es.close())
    return () => es.close()
  }

  async cancelRun(runId: string): Promise<void> {
    await this.request(`/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
  }

  async listReportFiles(runId: string): Promise<RunFile[]> {
    return this.request<RunFile[]>(`/runs/${encodeURIComponent(runId)}/report`)
  }

  async readText(runId: string, path: string): Promise<string> {
    let res: Response
    try {
      res = await this.fetchFn(this.fileUrl(runId, path))
    } catch {
      throw new ServiceError('Cannot reach the backend. Check that the server is running.')
    }
    if (!res.ok) throw new ServiceError(`Cannot read ${path} (HTTP ${res.status}).`)
    return res.text()
  }

  fileUrl(runId: string, path: string, inline = false): string {
    const parts = path.split('/').map(encodeURIComponent).join('/')
    return `${this.api}/runs/${encodeURIComponent(runId)}/files/${parts}${inline ? '?inline=1' : ''}`
  }
}
