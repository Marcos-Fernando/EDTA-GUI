import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { MockPipelineService } from '../services/MockPipelineService'
import { fasta, fileInputFor, renderApp } from '../test/utils'

const sw = (name: string) => screen.getByRole('switch', { name })
const startButton = () => screen.getByRole('button', { name: /start annotation/i })

describe('EDTA-GUI page', () => {
  it('starts in EDTA mode with every switch off and no AnnoTEP-only options', () => {
    renderApp()
    const mode = screen.getByRole('radiogroup', { name: 'Pipeline mode' })
    expect(within(mode).getByRole('radio', { name: 'EDTA' })).toBeChecked()
    for (const name of ['Overwrite', 'Sensitivity', 'Annotation', 'Evaluate', 'Force']) {
      expect(sw(name)).not.toBeChecked()
      expect(sw(name)).toBeEnabled()
    }
    expect(screen.queryByRole('switch', { name: 'Run LAI' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'TIR filter' })).toBeNull()
    expect(startButton()).toBeDisabled()
    expect(screen.getByText('Select a genome FASTA file.')).toBeInTheDocument()
  })

  it('AnnoTEP mode locks Sensitivity and Annotation on, shows its options and turns green', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: 'AnnoTEP' }))

    expect(sw('Sensitivity')).toBeChecked()
    expect(sw('Sensitivity')).toBeDisabled()
    expect(sw('Annotation')).toBeChecked()
    expect(sw('Annotation')).toBeDisabled()
    expect(sw('Run LAI')).toBeChecked()
    expect(sw('TIR filter')).not.toBeChecked()
    expect(sw('Annot. type')).not.toBeChecked()
    expect(screen.getByRole('heading', { level: 1, name: 'AnnoTEP' })).toBeInTheDocument()
    expect(document.documentElement.dataset.mode).toBe('annotep')

    await user.click(screen.getByRole('radio', { name: 'EDTA' }))
    expect(sw('Sensitivity')).not.toBeChecked()
    expect(sw('Annotation')).not.toBeChecked()
    expect(screen.queryByRole('switch', { name: 'Run LAI' })).toBeNull()
    expect(document.documentElement.dataset.mode).toBe('edta')
  })

  it('warns in the e-mail hint when the server cannot send e-mails', async () => {
    const health = vi
      .spyOn(MockPipelineService.prototype, 'health')
      .mockResolvedValue({ ok: true, label: 'x', mailConfigured: false })
    renderApp()
    expect(await screen.findByText(/E-mail is not set up on this server/)).toBeInTheDocument()
    health.mockRestore()
  })

  it('mode radiogroup works with the keyboard', async () => {
    const { user } = renderApp()
    screen.getByRole('radio', { name: 'EDTA' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'AnnoTEP' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'AnnoTEP' })).toHaveFocus()
  })

  it('Evaluate turns Annotation on; Annotation off disables exclude and rmout', async () => {
    const { user } = renderApp()
    const rmout = screen.getByRole('button', { name: /Browse: RepeatMasker library/ })
    expect(rmout).toBeDisabled()

    await user.click(sw('Evaluate'))
    expect(sw('Annotation')).toBeChecked()
    expect(rmout).toBeEnabled()

    await user.click(sw('Annotation'))
    expect(sw('Evaluate')).not.toBeChecked()
    expect(rmout).toBeDisabled()
  })

  it('MAKER mask turns Annotation on and enables exclude (EDTA mode only)', async () => {
    const { user } = renderApp()
    const exclude = screen.getByRole('button', { name: /Browse: Exclusion of masked regions/ })
    await user.click(sw('Annotation'))
    expect(exclude).toBeDisabled()
    expect(screen.getByText('Enable "MAKER mask" to use this file.')).toBeInTheDocument()

    await user.click(sw('MAKER mask'))
    expect(exclude).toBeEnabled()

    await user.click(sw('Annotation'))
    expect(sw('MAKER mask')).not.toBeChecked()
    expect(exclude).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'AnnoTEP' }))
    expect(screen.queryByRole('switch', { name: 'MAKER mask' })).not.toBeInTheDocument()
    expect(exclude).toBeEnabled()
  })

  it('shows inline errors and keeps Start disabled while values are invalid', async () => {
    const { user } = renderApp()
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('genome.fa'))
    expect(startButton()).toBeEnabled()

    const maxDiv = screen.getByLabelText('Max div. (%)')
    await user.clear(maxDiv)
    await user.type(maxDiv, '40.5')
    expect(screen.getByText('Enter a whole number from 0 to 100.')).toBeInTheDocument()
    expect(maxDiv).toHaveAttribute('aria-invalid', 'true')
    expect(startButton()).toBeDisabled()

    await user.clear(maxDiv)
    await user.type(maxDiv, '30')
    const threads = screen.getByLabelText('Threads')
    await user.clear(threads)
    await user.type(threads, '4')
    expect(screen.getByText('Enter a whole number of at least 10.')).toBeInTheDocument()
    expect(startButton()).toBeDisabled()

    await user.clear(threads)
    await user.type(threads, '12')
    await user.type(screen.getByLabelText('Mut. rate (-u)'), '1e-8')
    expect(startButton()).toBeEnabled()
  })

  it('Run name shows the results folder, validates inline and hides when reusing a run', async () => {
    const { user } = renderApp()
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('My genome.fa'))
    expect(
      screen.getByText('Optional. Results folder: My_genome_<date-time>. Empty = genome name.'),
    ).toBeInTheDocument()
    const name = screen.getByRole('textbox', { name: 'Run name' })
    await user.type(name, 'TAIR10 test')
    expect(screen.getByText(/no spaces/)).toBeInTheDocument()
    expect(startButton()).toBeDisabled()
    await user.clear(name)
    await user.type(name, 'TAIR10_test')
    expect(
      screen.getByText('Optional. Results folder: TAIR10_test_<date-time>. Empty = genome name.'),
    ).toBeInTheDocument()
    expect(startButton()).toBeEnabled()
    await user.click(screen.getByRole('radio', { name: 'final' }))
    expect(screen.queryByRole('textbox', { name: 'Run name' })).not.toBeInTheDocument()
  })

  it('previews the command built from the form', async () => {
    const { user } = renderApp()
    await user.upload(fileInputFor('Genome sequence (FASTA)'), fasta('My genome.fa'))
    await user.click(sw('Annotation'))
    await user.click(screen.getByText('Command preview'))
    // With Annotation on, the EDTA charts script runs after EDTA.pl.
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'PRE' &&
          el.textContent ===
            'EDTA.pl --genome My_genome.fa --species others --step all --sensitive 0 --threads 10 --anno 1 --evaluate 0\n' +
              'bash AnnoTEP/Scripts/generate_PLOTs-for-EDTA.sh My_genome.fa',
      ),
    ).toBeInTheDocument()
  })

  it('step ≠ all asks for a previous run and makes the genome optional', async () => {
    const { user } = renderApp('#/edta', { lineDelayMs: 1, seed: true })
    await user.click(screen.getByRole('radio', { name: 'final' }))
    const select = await screen.findByRole('combobox', { name: /Previous run/ })
    expect(screen.getByText('Select the previous run to continue from.')).toBeInTheDocument()
    expect(startButton()).toBeDisabled()

    const options = within(select).getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    expect(options.some((o) => o.textContent?.startsWith('panGenome_'))).toBe(false)
    // read-only runs (old results folder) cannot be continued
    expect(options.some((o) => o.textContent?.startsWith('example_'))).toBe(false)
    await user.selectOptions(select, options[1])
    expect(startButton()).toBeEnabled()

    await user.click(screen.getByRole('radio', { name: 'all' }))
    expect(screen.queryByRole('combobox', { name: /Previous run/ })).toBeNull()
  })

  it('opens the help panel and closes it with Escape', async () => {
    const { user } = renderApp()
    const trigger = screen.getByRole('button', { name: 'Help: Advanced options' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Advanced options' })
    expect(within(dialog).getByText(/RepeatMasker-based library/)).toBeInTheDocument()
    // The numeric parameters are explained next to their own section (02).
    expect(within(dialog).queryByText(/neutral mutation rate/i)).toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('Run test analysis asks first, then fills the form with TAIR10 and starts the run', async () => {
    const { user, service } = renderApp()
    const start = vi.spyOn(service, 'startEdtaRun')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await user.click(screen.getByRole('radio', { name: 'AnnoTEP' }))
    await user.click(screen.getByRole('button', { name: /run test analysis/i }))
    expect(confirm.mock.calls[0][0]).toMatch(/AnnoTEP test analysis[\s\S]*about 1 h 20 min/)
    expect(start).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: /run test analysis/i }))
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    const cfg = start.mock.calls[0][0]
    expect(cfg.mode).toBe('annotep')
    expect(cfg.genome?.name).toBe('TAIR10_chr1.fa')
    expect(cfg.runName).toBe('Test_genome')
    expect(cfg.switches).toMatchObject({ sensitive: true, anno: true, runLai: true })
    expect(screen.getByLabelText('Run name')).toHaveValue('Test_genome')
    expect(await start.mock.results[0].value).toMatchObject({
      runId: expect.stringMatching(/^Test_genome_/),
    })
    confirm.mockRestore()
  })

  it('explains the numeric parameters in the Run parameters help', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Help: Run parameters' }))
    const dialog = screen.getByRole('dialog', { name: 'Run parameters' })
    expect(within(dialog).getByText(/neutral mutation rate/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/maximum acceptable divergence/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/default and minimum: 10/)).toBeInTheDocument()
  })
})
