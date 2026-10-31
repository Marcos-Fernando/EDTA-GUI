/**
 * In-browser simulation of the pipeline engine.
 * - Re-validates every config, like the real server must.
 * - Runs in "background": start* resolves immediately with the run id.
 * - Replays log lines in the real EDTA/panEDTA format and writes the legacy
 *   status texts at the end.
 * Data shown by this service is fictitious and only exists in mock mode.
 */
import type { EdtaRunConfig, PanRunConfig, RunFile, RunSummary, TimelineContext } from '../types'
import type { EngineHealth, PipelineService, RunEvent } from './PipelineService'
import { ServiceError } from './PipelineService'
import {
  validateEmail,
  validateMaxDiv,
  validateMinInt,
  validateMutationRate,
} from '../config/rules'
import { FASTA_EXTENSIONS, PARAMS } from '../config/edtaFields'
import { PAN_PARAMS, panListName } from '../config/panFields'
import { expectedFinalMessage } from '../config/stepMatchers'
import { hasAllowedExtension, secureFilename, stripExtension } from '../utils/files'
import { folderTimestamp, unixDate } from '../utils/time'
import { DATE_TOKEN, edtaScript, panScript, type MockScript } from './mockScripts'

export const STATUS_OK = 'Annotation finalised'
export const STATUS_ERROR = 'Error in the annotation step'

interface MockRun {
  summary: RunSummary
  log: string[]
  timer: ReturnType<typeof setTimeout> | null
  listeners: Set<(e: RunEvent) => void>
}

export interface MockOptions {
  /** Delay between log lines. */
  lineDelayMs?: number
  /** Pre-populate Results with a few finished runs. */
  seed?: boolean
  now?: () => Date
}

const LOG_TAIL = 20

/** Mock-only folder, shaped like the backend's (gui/backend/results or the legacy gui/results). */
const mockPath = (id: string, legacy = false) =>
  `/mock/gui/${legacy ? 'results' : 'backend/results'}/${id}`

export class MockPipelineService implements PipelineService {
  readonly kind = 'mock' as const
  private runs = new Map<string, MockRun>()
  private lineDelayMs: number
  private now: () => Date

  constructor(options: MockOptions = {}) {
    this.lineDelayMs = options.lineDelayMs ?? 450
    this.now = options.now ?? (() => new Date())
    if (options.seed ?? true) this.seed()
  }

  async health(): Promise<EngineHealth> {
    return { ok: true, label: 'mock engine · simulated runs', mailConfigured: true }
  }

  /* ------------------------------ start ------------------------------ */

  async startEdtaRun(cfg: EdtaRunConfig): Promise<{ runId: string }> {
    const errors: Record<string, string> = {}
    const add = (k: string, m: string | null) => m && (errors[k] = m)
    add('email', validateEmail(cfg.email ?? ''))
    add('mutationRate', cfg.mutationRate === null ? null : validateMutationRate(cfg.mutationRate))
    add('maxDiv', cfg.maxDiv === null ? null : validateMaxDiv(String(cfg.maxDiv)))
    add('threads', validateMinInt(String(cfg.threads), PARAMS.threads.min))

    let previous: MockRun | undefined
    if (cfg.step !== 'all') {
      previous = cfg.previousRunId ? this.runs.get(cfg.previousRunId) : undefined
      if (!previous) errors.previousRunId = 'The selected run was not found.'
      else if (previous.summary.readOnly) {
        errors.previousRunId =
          'Runs from the old results folder are read-only and cannot be continued.'
      } else if (previous.summary.status === 'running') {
        errors.previousRunId = 'The selected run is still running.'
      } else if (previous.summary.kind === 'pan') {
        errors.previousRunId = 'A panEDTA run cannot be continued here.'
      }
    }
    if (cfg.genome && !hasAllowedExtension(cfg.genome.name, FASTA_EXTENSIONS)) {
      errors.genome = `Accepted extensions: ${FASTA_EXTENSIONS.join(' ')}`
    }
    const genome = cfg.genome ? secureFilename(cfg.genome.name) : previous?.summary.genome
    if (!genome) errors.genome = 'Select a genome FASTA file.'
    if (Object.keys(errors).length > 0 || !genome) {
      throw new ServiceError('The run was not started: check the highlighted fields.', errors)
    }

    const runId = previous
      ? previous.summary.id
      : this.uniqueId(`${cfg.runName ?? stripExtension(genome)}_${folderTimestamp(this.now())}`)
    const options: TimelineContext = {
      kind: cfg.mode,
      step: cfg.step,
      anno: cfg.mode === 'annotep' || cfg.switches.anno,
      evaluate: cfg.switches.evaluate,
      runLai: cfg.mode === 'annotep' && cfg.switches.runLai,
      charts: cfg.mode === 'edta' && cfg.switches.anno,
    }
    this.launch(runId, cfg.mode, genome, options, edtaScript(cfg, genome))
    return { runId }
  }

  async startPanRun(cfg: PanRunConfig): Promise<{ runId: string }> {
    const errors: Record<string, string> = {}
    const add = (k: string, m: string | null) => m && (errors[k] = m)
    add('email', validateEmail(cfg.email ?? ''))
    add('threads', validateMinInt(String(cfg.threads), PAN_PARAMS.threads.min))
    add('copies', validateMinInt(String(cfg.copies), PAN_PARAMS.copies.min))
    if (cfg.pairs.length === 0) errors.pairs = 'Select at least one genome.'
    const names = cfg.pairs.map((p) => secureFilename(p.genome.name))
    if (new Set(names).size !== names.length) errors.pairs = 'Genome file names must be unique.'
    if (Object.keys(errors).length > 0) {
      throw new ServiceError('The run was not started: check the highlighted fields.', errors)
    }

    const ts = folderTimestamp(this.now())
    const runId = this.uniqueId(`panGenome_${ts}`)
    const options: TimelineContext = {
      kind: 'pan',
      step: 'all',
      anno: true,
      evaluate: false,
      runLai: false,
    }
    const script = panScript(cfg, panListName(ts), `results/${runId}`)
    this.launch(runId, 'pan', null, options, script)
    return { runId }
  }

  /* ------------------------------ queries ---------------------------- */

  async listRuns(): Promise<RunSummary[]> {
    return [...this.runs.values()].map((r) => ({ ...r.summary }))
  }

  async getRun(runId: string): Promise<RunSummary> {
    return { ...this.get(runId).summary }
  }

  async getLog(runId: string, tail?: number): Promise<string[]> {
    const log = this.get(runId).log
    return tail ? log.slice(-tail) : [...log]
  }

  subscribeRun(runId: string, onEvent: (event: RunEvent) => void): () => void {
    const run = this.runs.get(runId)
    if (!run) {
      queueMicrotask(() => onEvent({ type: 'log', lines: [], replace: true }))
      return () => {}
    }
    run.listeners.add(onEvent)
    onEvent({ type: 'log', lines: [...run.log], replace: true })
    onEvent({ type: 'status', summary: { ...run.summary } })
    return () => run.listeners.delete(onEvent)
  }

  async cancelRun(runId: string): Promise<void> {
    const run = this.get(runId)
    if (run.summary.readOnly)
      throw new ServiceError('Runs from the old results folder are read-only.')
    if (run.summary.status !== 'running') return
    if (run.timer) clearTimeout(run.timer)
    this.append(run, ['', '[Pipeline cancelled by user]'])
    this.finish(run, false)
  }

  /** The mock has no output files: the report view shows its empty state. */
  async listReportFiles(runId: string): Promise<RunFile[]> {
    this.get(runId)
    return []
  }

  async readText(runId: string, path: string): Promise<string> {
    this.get(runId)
    throw new ServiceError(`The mock has no file ${path}.`)
  }

  fileUrl(runId: string, path: string): string {
    return `#mock/${runId}/${path}`
  }

  async loadTestFile(name: string): Promise<File> {
    return new File(['>chr1\nACGTACGTACGT\n'], name)
  }

  /* ------------------------------ internals -------------------------- */

  private get(runId: string): MockRun {
    const run = this.runs.get(runId)
    if (!run) throw new ServiceError(`Run "${runId}" not found.`)
    return run
  }

  private uniqueId(base: string): string {
    let id = base
    for (let i = 2; this.runs.has(id); i++) id = `${base}-${i}`
    return id
  }

  private launch(
    runId: string,
    kind: RunSummary['kind'],
    genome: string | null,
    options: TimelineContext,
    script: MockScript,
  ) {
    const existing = this.runs.get(runId)
    const run: MockRun = existing ?? { summary: null!, log: [], timer: null, listeners: new Set() }
    // Reusing a folder overwrites log.txt and removes status.txt (legacy behaviour).
    run.log = []
    run.summary = {
      id: runId,
      kind,
      genome,
      startedAt: this.now().toISOString(),
      finishedAt: null,
      status: 'running',
      statusText: null,
      finalMessageFound: null,
      options,
      lastLogLines: [],
      readOnly: false,
      queuePosition: null,
      path: mockPath(runId),
    }
    this.runs.set(runId, run)
    this.emit(run, { type: 'log', lines: [], replace: true })
    this.emit(run, { type: 'status', summary: { ...run.summary } })

    let i = 0
    const tick = () => {
      if (i < script.lines.length) {
        this.append(run, [this.stamp(script.lines[i])])
        if (script.failAfter !== null && i >= script.failAfter) {
          this.finish(run, false)
          return
        }
        i += 1
        run.timer = setTimeout(tick, this.lineDelayMs)
        return
      }
      this.finish(run, true)
    }
    run.timer = setTimeout(tick, this.lineDelayMs)
  }

  private stamp(line: string): string {
    return line.split(DATE_TOKEN).join(unixDate(this.now()))
  }

  private append(run: MockRun, lines: string[]) {
    run.log.push(...lines)
    run.summary.lastLogLines = run.log.slice(-LOG_TAIL)
    this.emit(run, { type: 'log', lines })
  }

  private finish(run: MockRun, ok: boolean) {
    run.timer = null
    const final = run.summary.options ? expectedFinalMessage(run.summary.options) : null
    run.summary = {
      ...run.summary,
      status: ok ? 'completed' : 'failed',
      statusText: ok ? STATUS_OK : STATUS_ERROR,
      finishedAt: this.now().toISOString(),
      finalMessageFound: final ? run.log.some((l) => final.test(l)) : null,
      lastLogLines: run.log.slice(-LOG_TAIL),
    }
    this.emit(run, { type: 'status', summary: { ...run.summary } })
  }

  private emit(run: MockRun, event: RunEvent) {
    for (const l of run.listeners) l(event)
  }

  /** Fictitious finished runs so the Results page has content in mock mode. */
  private seed() {
    const base = this.now().getTime()
    const at = (hoursAgo: number) => new Date(base - hoursAgo * 3_600_000)
    const fake = (name: string) => new File([''], name)

    const make = (
      id: string,
      kind: RunSummary['kind'],
      genome: string | null,
      startedHoursAgo: number,
      durationH: number,
      script: MockScript,
      options: TimelineContext | null,
      ok: boolean,
      readOnly = false,
    ) => {
      const started = at(startedHoursAgo)
      const lines = script.lines
        .slice(0, script.failAfter === null ? undefined : script.failAfter + 1)
        .map((l) => l.split(DATE_TOKEN).join(unixDate(started)))
      const final = options ? expectedFinalMessage(options) : null
      this.runs.set(id, {
        log: lines,
        timer: null,
        listeners: new Set(),
        summary: {
          id,
          kind,
          genome,
          startedAt: started.toISOString(),
          finishedAt: at(startedHoursAgo - durationH).toISOString(),
          status: ok ? 'completed' : 'failed',
          statusText: ok ? STATUS_OK : STATUS_ERROR,
          finalMessageFound: final ? lines.some((l) => final.test(l)) : null,
          options,
          lastLogLines: lines.slice(-LOG_TAIL),
          readOnly,
          queuePosition: null,
          path: mockPath(id, readOnly),
        },
      })
    }

    const edtaCfg = (mode: 'edta' | 'annotep', genome: string): EdtaRunConfig => ({
      mode,
      email: null,
      genome: fake(genome),
      runName: null,
      species: 'others',
      step: 'all',
      previousRunId: null,
      switches: {
        overwrite: false,
        sensitive: mode === 'annotep',
        anno: true,
        evaluate: mode === 'edta',
        maker: false,
        force: false,
        tirFilter: false,
        annotType: false,
        runLai: mode === 'annotep',
      },
      mutationRate: null,
      maxDiv: null,
      threads: 10,
      files: { cds: null, curatedlib: null, exclude: null, rmlib: null, rmout: null },
    })
    const ctx = (kind: 'edta' | 'annotep', evaluate: boolean): TimelineContext => ({
      kind,
      step: 'all',
      anno: true,
      evaluate,
      runLai: kind === 'annotep',
      charts: kind === 'edta',
    })

    const stamp = (h: number) => folderTimestamp(at(h))
    make(
      `Athaliana_${stamp(50)}`,
      'annotep',
      'Athaliana.fasta',
      50,
      9,
      edtaScript(edtaCfg('annotep', 'Athaliana.fasta'), 'Athaliana.fasta'),
      ctx('annotep', false),
      true,
    )
    make(
      `genome_${stamp(30)}`,
      'edta',
      'genome.fa',
      30,
      0.2,
      edtaScript(edtaCfg('edta', 'genome.fa'), 'genome.fa'),
      ctx('edta', true),
      true,
    )
    make(
      `rice_fail_${stamp(20)}`,
      'edta',
      'rice_fail.fa',
      20,
      1,
      edtaScript(edtaCfg('edta', 'rice_fail.fa'), 'rice_fail.fa'),
      ctx('edta', true),
      false,
    )
    make(
      `example_${stamp(80)}`,
      'unknown',
      null,
      80,
      0.1,
      { lines: ['Test file'], failAfter: null },
      null,
      true,
      true, // read-only, like the legacy gui/results folders in the backend
    )

    const panTs = stamp(70)
    const pan: PanRunConfig = {
      email: null,
      pairs: [
        { genome: fake('Ler.test.fa'), cds: null },
        { genome: fake('Col.test.fa'), cds: fake('genome.cds.fa') },
      ],
      cds: fake('genome.cds.fa'),
      library: null,
      threads: 10,
      copies: 3,
    }
    make(
      `panGenome_${panTs}`,
      'pan',
      null,
      70,
      2,
      panScript(pan, panListName(panTs), `results/panGenome_${panTs}`),
      { kind: 'pan', step: 'all', anno: true, evaluate: false, runLai: false },
      true,
    )
  }
}
