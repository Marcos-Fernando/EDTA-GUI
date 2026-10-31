import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { fasta, fileInputFor, renderApp } from '../test/utils'

const startButton = () => screen.getByRole('button', { name: /start annotation/i })

describe('panEDTA-GUI page', () => {
  it('lists genome rows: add, remove (first row is fixed)', async () => {
    const { user } = renderApp('#/pan')
    expect(screen.getByText('Genome 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove genome 1' })).toBeNull()

    await user.click(screen.getByRole('button', { name: /add genome/i }))
    await user.click(screen.getByRole('button', { name: /add genome/i }))
    expect(screen.getByText('Genome 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove genome 2' }))
    expect(screen.queryByText('Genome 3')).toBeNull()
    expect(screen.getByText('Genome 2')).toBeInTheDocument()
  })

  it('requires a genome and the general CDS before starting', async () => {
    const { user } = renderApp('#/pan')
    expect(startButton()).toBeDisabled()
    expect(screen.getByText('Select at least one genome.')).toBeInTheDocument()
    expect(screen.getByText('The coding DNA sequence (CDS) file is required.')).toBeInTheDocument()

    await user.upload(fileInputFor('Genome 1 (FASTA)'), fasta('Ler.fa'))
    await user.upload(fileInputFor('Coding DNA sequence (cds)'), fasta('genome.cds.fa'))
    expect(startButton()).toBeEnabled()
  })

  it('validates full-length copies ≥ 3', async () => {
    const { user } = renderApp('#/pan')
    const copies = screen.getByLabelText(/Min. full-length copies/)
    expect(copies).toHaveValue('3')
    await user.clear(copies)
    await user.type(copies, '2')
    expect(screen.getByText('Enter a whole number of at least 3.')).toBeInTheDocument()
  })

  it('Run test analysis starts the EDTA toy example (Col with CDS, Ler without)', async () => {
    const { user, service } = renderApp('#/pan')
    const start = vi.spyOn(service, 'startPanRun')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: /run test analysis/i }))
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    const cfg = start.mock.calls[0][0]
    expect(cfg.pairs.map((p) => [p.genome.name, p.cds?.name ?? null])).toEqual([
      ['Col.test.fa', 'genome.cds.fa'],
      ['Ler.test.fa', null],
    ])
    expect(cfg.cds.name).toBe('genome.cds.fa')
    expect(cfg.library?.name).toBe('athrep.updated.nonredun.fasta')
    expect(cfg.copies).toBe(3)
    confirm.mockRestore()
  })

  it('flags a CDS without a genome in its row', async () => {
    const { user } = renderApp('#/pan')
    await user.upload(fileInputFor('CDS 1 (optional)'), fasta('orphan.cds.fa'))
    expect(screen.getByText('A CDS file needs a genome in the same row.')).toBeInTheDocument()
  })
})
