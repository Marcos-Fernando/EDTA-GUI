import { describe, expect, it, vi } from 'vitest'
import type { EdtaRunConfig, PanRunConfig, RunSummary } from '../types'
import { HttpPipelineService } from './HttpPipelineService'
import { ServiceError, type RunEvent } from './PipelineService'

const file = (name: string) => new File(['>chr1\nACGT\n'], name)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

class FakeEventSource {
  listeners = new Map<string, ((e: MessageEvent) => void)[]>()
  closed = false
  url: string
  constructor(url: string) {
    this.url = url
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners.get(type) ?? []) {
      fn(new MessageEvent(type, { data: JSON.stringify(data) }))
    }
  }
  close() {
    this.closed = true
  }
}

const edtaCfg: EdtaRunConfig = {
  mode: 'annotep',
  email: 'a@b.org',
  genome: file('genome.fa'),
  species: 'rice',
  step: 'all',
  previousRunId: null,
  switches: {
    overwrite: false,
    sensitive: true,
    anno: true,
    evaluate: true,
    force: false,
    tirFilter: true,
    annotType: false,
    runLai: true,
  },
  mutationRate: '7e-9',
  maxDiv: null,
  threads: 12,
  files: { cds: file('genome.cds.fa'), curatedlib: null, exclude: null, rmlib: null, rmout: null },
}

describe('HttpPipelineService', () => {
  it('posts the EDTA config as JSON plus the files (multipart)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ runId: 'genome_20261006-120000' }, 202))
    const svc = new HttpPipelineService({ baseUrl: 'http://x', fetchFn })
    await expect(svc.startEdtaRun(edtaCfg)).resolves.toEqual({ runId: 'genome_20261006-120000' })

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://x/api/runs/edta')
    expect(init.method).toBe('POST')
    const form = init.body as FormData
    expect(JSON.parse(form.get('config') as string)).toEqual({
      mode: 'annotep',
      email: 'a@b.org',
      species: 'rice',
      step: 'all',
      previousRunId: null,
      switches: edtaCfg.switches,
      mutationRate: '7e-9',
      maxDiv: null,
      threads: 12,
    })
    expect((form.get('genome') as File).name).toBe('genome.fa')
    expect((form.get('cds') as File).name).toBe('genome.cds.fa')
    expect(form.has('exclude')).toBe(false)
  })

  it('omits the genome when continuing a run without a new one', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ runId: 'x' }, 202))
    const svc = new HttpPipelineService({ fetchFn })
    await svc.startEdtaRun({ ...edtaCfg, genome: null, step: 'final', previousRunId: 'x' })
    const form = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(form.has('genome')).toBe(false)
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('/api/runs/edta')
  })

  it('turns error bodies into ServiceError with field errors', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: 'The run was not started', fieldErrors: { maxDiv: 'bad' } }, 422),
    )
    const svc = new HttpPipelineService({ fetchFn })
    const err = await svc.startEdtaRun(edtaCfg).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceError)
    expect((err as ServiceError).fieldErrors).toEqual({ maxDiv: 'bad' })
  })

  it('reports an unreachable backend', async () => {
    const svc = new HttpPipelineService({
      fetchFn: vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    })
    await expect(svc.listRuns()).rejects.toThrow(/Cannot reach the backend/)
    await expect(svc.health()).resolves.toEqual({
      ok: false,
      label: 'backend unreachable',
      mailConfigured: null,
    })
  })

  it('sends pan rows by index and maps row errors back to the form row ids', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        { message: 'invalid', fieldErrors: { 'pairs.1.genome': 'dup', copies: 'min 3' } },
        422,
      ),
    )
    const svc = new HttpPipelineService({ fetchFn })
    const cfg: PanRunConfig = {
      email: null,
      pairs: [
        { id: 'pair-a', genome: file('A.fa'), cds: null },
        { id: 'pair-b', genome: file('B.fa'), cds: file('B.cds.fa') },
      ],
      cds: file('g.cds.fa'),
      library: null,
      threads: 10,
      copies: 3,
    }
    const err = (await svc.startPanRun(cfg).catch((e: unknown) => e)) as ServiceError
    expect(err.fieldErrors).toEqual({ 'pairs.pair-b.genome': 'dup', copies: 'min 3' })

    const form = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(JSON.parse(form.get('config') as string)).toEqual({
      email: null,
      threads: 10,
      copies: 3,
      pairs: 2,
    })
    expect((form.get('pairs.0.genome') as File).name).toBe('A.fa')
    expect(form.has('pairs.0.cds')).toBe(false)
    expect((form.get('pairs.1.cds') as File).name).toBe('B.cds.fa')
    expect((form.get('cds') as File).name).toBe('g.cds.fa')
  })

  it('fills defaults for fields missing in the summary', async () => {
    const svc = new HttpPipelineService({
      fetchFn: vi.fn(async () => jsonResponse([{ id: 'a', status: 'completed' }])),
    })
    const [run] = await svc.listRuns()
    expect(run.readOnly).toBe(false)
    expect(run.queuePosition).toBeNull()
    expect(run.path).toBeNull()
  })

  it('subscribes with SSE and closes the stream on "end"', () => {
    let es: FakeEventSource | undefined
    const svc = new HttpPipelineService({
      eventSource: (url) => {
        es = new FakeEventSource(url)
        return es as unknown as EventSource
      },
    })
    const events: RunEvent[] = []
    const unsubscribe = svc.subscribeRun('genome_1', (e) => events.push(e))
    expect(es!.url).toBe('/api/runs/genome_1/events')

    es!.emit('log', { lines: ['a', 'b'], replace: true })
    es!.emit('status', { id: 'genome_1', status: 'running', queuePosition: 1 } as RunSummary)
    es!.emit('end', {})
    expect(events[0]).toEqual({ type: 'log', lines: ['a', 'b'], replace: true })
    expect(events[1]).toMatchObject({
      type: 'status',
      summary: { queuePosition: 1, readOnly: false },
    })
    expect(es!.closed).toBe(true)
    unsubscribe()
  })

  it('health: ok and degraded', async () => {
    const ok = new HttpPipelineService({
      fetchFn: vi.fn(async () =>
        jsonResponse({
          status: 'ok',
          resultsDirWritable: true,
          condaFound: true,
          condaEnvs: { edta: 'EDTAgui', annotep: 'annotepgui_3_11' },
          mailConfigured: true,
        }),
      ),
    })
    await expect(ok.health()).resolves.toEqual({
      ok: true,
      label: 'EDTAgui / annotepgui_3_11',
      mailConfigured: true,
    })
    const degraded = new HttpPipelineService({
      fetchFn: vi.fn(async () =>
        jsonResponse({
          status: 'degraded',
          resultsDirWritable: true,
          condaFound: false,
          condaEnvs: {},
          mailConfigured: false,
        }),
      ),
    })
    await expect(degraded.health()).resolves.toEqual({
      ok: false,
      label: 'backend degraded: conda not found',
      mailConfigured: false,
    })
  })
})
