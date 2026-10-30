import { describe, expect, it } from 'vitest'
import type { RunSummary } from '../types'
import { extensionOf, hasAllowedExtension, secureFilename, stripExtension } from './files'
import { sortRuns, statusView } from './runs'
import { durationBetween, folderTimestamp, formatDuration } from './time'
import { parseHash, hrefFor } from '../hooks/useHashRoute'

describe('files', () => {
  it('secureFilename mirrors werkzeug for common cases', () => {
    expect(secureFilename('My Genome.fa')).toBe('My_Genome.fa')
    expect(secureFilename('../../etc/passwd')).toBe('etc_passwd')
    expect(secureFilename('genómé.fa')).toBe('genome.fa')
    expect(secureFilename('a|b;c.fa')).toBe('abc.fa')
  })
  it('extensions', () => {
    expect(extensionOf('x.FASTA')).toBe('.fasta')
    expect(hasAllowedExtension('x.fa', ['.fa'])).toBe(true)
    expect(hasAllowedExtension('x.txt', ['.fa'])).toBe(false)
    expect(hasAllowedExtension('x.txt', [])).toBe(true)
    expect(stripExtension('Athaliana.fasta')).toBe('Athaliana')
  })
})

describe('time', () => {
  it('folder timestamp uses YYYYmmdd-HHMMSS', () => {
    expect(folderTimestamp(new Date(2026, 9, 6, 9, 5, 3))).toBe('20261006-090503')
  })
  it('formats durations', () => {
    expect(formatDuration(65_000)).toBe('01:05')
    expect(formatDuration(3_725_000)).toBe('01:02:05')
    expect(durationBetween(null, null)).toBeNull()
  })
})

const run = (id: string, status: RunSummary['status'], startedAt: string | null): RunSummary => ({
  id,
  kind: 'edta',
  genome: null,
  startedAt,
  finishedAt: null,
  status,
  statusText: null,
  finalMessageFound: null,
  options: null,
  lastLogLines: [],
  readOnly: false,
  queuePosition: null,
  path: null,
})

describe('runs', () => {
  it('sorts running first, then most recent (fixes legacy order)', () => {
    const sorted = sortRuns([
      run('old', 'completed', '2026-01-01T00:00:00Z'),
      run('new', 'failed', '2026-03-01T00:00:00Z'),
      run('live', 'running', '2025-01-01T00:00:00Z'),
      run('legacy', 'completed', null),
    ])
    expect(sorted.map((r) => r.id)).toEqual(['live', 'new', 'old', 'legacy'])
  })

  it('status view: Annotating ..., errors and the missing final message warning', () => {
    expect(statusView({ status: 'running', statusText: null, finalMessageFound: null }).label).toBe(
      'Annotating ...',
    )
    expect(
      statusView({
        status: 'failed',
        statusText: 'Error in the annotation step',
        finalMessageFound: null,
      }).tone,
    ).toBe('error')
    const warn = statusView({
      status: 'completed',
      statusText: 'Annotation finalised',
      finalMessageFound: false,
    })
    expect(warn.tone).toBe('warn')
    expect(warn.note).toMatch(/final message/)
    const queued = statusView({
      status: 'running',
      statusText: null,
      finalMessageFound: null,
      queuePosition: 2,
    })
    expect(queued.label).toBe('Queued (#2)')
    expect(queued.note).toMatch(/right after the current one/)
  })
})

describe('hash routes', () => {
  it('parses and builds routes', () => {
    expect(parseHash('')).toEqual({ page: 'edta' })
    expect(parseHash('#/pan')).toEqual({ page: 'pan' })
    expect(parseHash('#/results')).toEqual({ page: 'results' })
    expect(parseHash('#/runs/genome_20260101-000000')).toEqual({
      page: 'run',
      runId: 'genome_20260101-000000',
      tab: 'execution',
    })
    expect(parseHash('#/runs/genome_20260101-000000/report')).toEqual({
      page: 'run',
      runId: 'genome_20260101-000000',
      tab: 'report',
    })
    expect(hrefFor({ page: 'run', runId: 'a b' })).toBe('#/runs/a%20b')
    expect(hrefFor({ page: 'run', runId: 'a b', tab: 'report' })).toBe('#/runs/a%20b/report')
    expect(parseHash('#/guide')).toEqual({ page: 'guide' })
    expect(parseHash('#/guide/storage')).toEqual({ page: 'guide', section: 'storage' })
    expect(hrefFor({ page: 'guide' })).toBe('#/guide')
    expect(hrefFor({ page: 'guide', section: 'install' })).toBe('#/guide/install')
  })
})
