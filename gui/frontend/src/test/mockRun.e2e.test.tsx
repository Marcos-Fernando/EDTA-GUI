/**
 * End-to-end with the mock engine: fill the form, start, follow the run in the
 * workspace (timeline + console + stats) and find it in Results.
 */
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import { fasta, fileInputFor, renderApp } from './utils'

const goTo = (hash: string) =>
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })

const statValue = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement

describe('mock run, end to end', () => {
  it('EDTA run: starts in background, timeline follows the log, finishes and shows in Results', async () => {
    const { user } = renderApp()
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('genome.fa'))
    await user.click(screen.getByRole('switch', { name: 'Evaluate' }))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))

    await waitFor(() => expect(statValue('Status')).toHaveTextContent('Completed'), {
      timeout: 5000,
    })
    expect(statValue('Progress')).toHaveTextContent('6/6 steps')

    const timeline = screen.getByRole('region', { name: 'Execution timeline' })
    expect(within(timeline).getAllByText('completed')).toHaveLength(6)
    const log = screen.getByRole('log', { name: 'Execution log' })
    expect(within(log).getByText(/Evaluation of TE annotation finished!/)).toBeInTheDocument()

    goTo('#/results')
    const row = (await screen.findByRole('rowheader', { name: /^genome_\d{8}-\d{6}$/ })).closest(
      'tr',
    )!
    expect(within(row).getByText('Annotation finalised')).toBeInTheDocument()
    expect(within(row).getByText('EDTA')).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: /show log/i }))
    expect(screen.getByRole('log', { name: /Last log lines of genome_/ })).toBeInTheDocument()
  })

  it('AnnoTEP run includes LAI and reports; a failing genome ends as Failed', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: 'AnnoTEP' }))
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('plant.fa'))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))
    await waitFor(() => expect(statValue('Status')).toHaveTextContent('Completed'), {
      timeout: 5000,
    })
    const timeline = screen.getByRole('region', { name: 'Execution timeline' })
    expect(within(timeline).getByText('LAI assessment')).toBeInTheDocument()
    expect(within(timeline).getByText('Charts and reports')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear: Genome sequence (FASTA)' }))
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('will_fail.fa'))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))
    await waitFor(() => expect(statValue('Status')).toHaveTextContent('Failed'), { timeout: 5000 })
    // A new run remounts the workspace (new subscription): query the timeline again.
    const timeline2 = screen.getByRole('region', { name: 'Execution timeline' })
    expect(within(timeline2).getByText('failed')).toBeInTheDocument()
  })

  it('panEDTA run with two genomes', async () => {
    const { user } = renderApp('#/pan')
    await user.upload(fileInputFor('Genome 1 (FASTA)'), fasta('Ler.fa'))
    await user.click(screen.getByRole('button', { name: /add genome/i }))
    await user.upload(fileInputFor('Genome 2 (FASTA)'), fasta('Col.fa'))
    await user.upload(fileInputFor('CDS 2 (optional)'), fasta('Col.cds.fa'))
    await user.upload(fileInputFor('Coding DNA sequence (cds)'), fasta('genome.cds.fa'))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))

    await waitFor(() => expect(statValue('Status')).toHaveTextContent('Completed'), {
      timeout: 5000,
    })
    expect(statValue('Progress')).toHaveTextContent('6/6 steps')
    expect(screen.getByText(/^run id/)).toHaveTextContent(/panGenome_\d{8}-\d{6}/)
    expect(screen.getByText(/^Saved in/).parentElement).toHaveTextContent(
      /backend\/results\/panGenome_\d{8}-\d{6}$/,
    )
    expect(screen.getByRole('button', { name: 'Copy folder path' })).toBeInTheDocument()
  })

  it('a run can be cancelled', async () => {
    const { user } = renderApp('#/edta', { lineDelayMs: 50, seed: false })
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('genome.fa'))
    await user.click(screen.getByRole('button', { name: /start annotation/i }))
    await user.click(await screen.findByRole('button', { name: /cancel run/i }))
    await waitFor(() => expect(statValue('Status')).toHaveTextContent('Failed'))
    expect(screen.getByText('[Pipeline cancelled by user]')).toBeInTheDocument()
  })
})
