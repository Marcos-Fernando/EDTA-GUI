import { afterEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import type { RunSummary } from '../types'
import { fasta, fileInputFor, renderApp } from '../test/utils'
import { endedRuns, startNotice } from './notices'

const summary = (id: string, status: RunSummary['status'], readOnly = false): RunSummary => ({
  id,
  kind: 'edta',
  genome: null,
  startedAt: null,
  finishedAt: null,
  status,
  statusText: null,
  finalMessageFound: null,
  options: null,
  lastLogLines: [],
  readOnly,
  queuePosition: null,
  path: null,
})

describe('notices', () => {
  it('only runs seen running (or started here) are announced when they end', () => {
    const previous = new Map<string, RunSummary['status']>([
      ['a', 'running'],
      ['b', 'completed'],
      ['legacy', 'running'],
    ])
    const runs = [
      summary('a', 'completed'),
      summary('b', 'completed'),
      summary('legacy', 'failed', true),
      summary('fast', 'failed'),
      summary('other', 'completed'),
    ]
    expect(endedRuns(previous, runs, new Set(['fast'])).map((r) => r.id)).toEqual(['a', 'fast'])
  })

  it('a queued run gets a "waiting in line" notice', () => {
    expect(startNotice('x', 2).title).toBe('Analysis is waiting in line')
    expect(startNotice('x', null).title).toBe('Analysis started')
  })
})

describe('start and end notices', () => {
  afterEach(() => {
    document.title = ''
  })

  it('announces the start and the end of a run, and marks the tab title', async () => {
    const { user } = renderApp('#/edta', { lineDelayMs: 1, seed: false }, 20)
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('genome.fa'))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))

    const notices = screen.getByRole('region', { name: 'Notifications' })
    expect(await within(notices).findByText('Analysis started')).toBeInTheDocument()

    expect(
      await within(notices).findByText('Analysis finished', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(document.title.startsWith('✓ Finished · ')).toBe(true)
    const open = within(notices).getByRole('link', { name: 'Open results' })
    expect(open.getAttribute('href')).toMatch(/^#\/runs\/genome_\d{8}-\d{6}$/)

    for (const close of within(notices).getAllByRole('button', { name: /close/i })) {
      await user.click(close)
    }
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull()
    expect(document.title.startsWith('✓')).toBe(false)
  })

  it('opening the page does not announce runs that ended before', async () => {
    renderApp('#/results', { lineDelayMs: 1 }, 20)
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull()
  })
})
