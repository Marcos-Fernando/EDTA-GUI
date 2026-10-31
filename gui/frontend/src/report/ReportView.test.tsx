import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import lite from './__fixtures__/lite.tbl?raw'
import teannoSum from './__fixtures__/teanno.sum?raw'
import nwk from './__fixtures__/all.nwk?raw'
import { AppProvider } from '../state/AppProvider'
import { MockPipelineService } from '../services/MockPipelineService'
import type { RunFile, RunSummary } from '../types'
import { ReportView } from './ReportView'

// the chart library needs a real SVG engine: replace it by a marker
vi.mock('katucharts.js', () => ({ default: {} }))
vi.mock('katucharts.js/bio', () => ({}))
vi.mock('katucharts.js/react', () => ({
  KatuChartsReact: ({ options }: { options?: { title?: { text?: string } } }) => (
    <div data-testid="katu-chart" data-title={options?.title?.text} />
  ),
}))

class FilesService extends MockPipelineService {
  private readonly files: Record<string, string>
  constructor(files: Record<string, string>) {
    super({ seed: false })
    this.files = files
  }
  override async listReportFiles(): Promise<RunFile[]> {
    return Object.entries(this.files).map(([path, text]) => ({
      path,
      size: text.length,
      modifiedAt: '',
    }))
  }
  override async readText(_runId: string, path: string): Promise<string> {
    return this.files[path]
  }
  override fileUrl(runId: string, path: string): string {
    return `/files/${runId}/${path}`
  }
}

const summary = { status: 'completed', path: '/data/results/TAIR10_chr1_1' } as RunSummary

function renderReport(files: Record<string, string>) {
  return render(
    <AppProvider service={new FilesService(files)}>
      <ReportView runId="TAIR10_chr1_1" summary={summary} />
    </AppProvider>,
  )
}

const REPORT = {
  'TAIR10_chr1.fa.mod.EDTA.TEanno.gff3': 'x',
  'REPORT/TAIR10_chr1.fa.mod-LITE.tbl': lite,
  'REPORT/TE-Report-bar.png': 'png',
  'REPORT/LTR_RT-Tree1_original_circular.png': 'png',
  'REPORT/TREE/all.nwk': nwk,
}

const section = (name: string) => screen.getByRole('region', { name })

describe('ReportView', () => {
  it('summary: donut of the masked genome, a clicked table row shows its share', async () => {
    renderReport(REPORT)
    const summaryRegion = await screen.findByRole('region', { name: 'Quantitative summary' })
    const chart = await within(summaryRegion).findByTestId('katu-chart')
    expect(chart).toHaveAttribute('data-title', 'Genome masked by repeats')

    const user = userEvent.setup()
    const row = within(summaryRegion).getByText('Class I Total').closest('[role="row"]')!
    await user.click(row)
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(within(summaryRegion).getByTestId('katu-chart')).toHaveAttribute(
      'data-title',
      'Class I Total',
    )

    await user.click(within(summaryRegion).getByRole('button', { name: 'Show total masked' }))
    expect(within(summaryRegion).getByTestId('katu-chart')).toHaveAttribute(
      'data-title',
      'Genome masked by repeats',
    )
  })

  it('panEDTA: the EDTA summary of each genome as the same table and donut', async () => {
    const ler = teannoSum.replace(/^Total {2,}.*$/m, 'Total   80   100000   10.00%')
    renderReport({
      'Col.test.fa.mod.EDTA.TEanno.sum': teannoSum,
      'Ler.test.fa.mod.EDTA.TEanno.sum': ler,
      'genome.cds.list.panEDTA.TElib.fa': '>x',
    })
    const region = await screen.findByRole('region', { name: 'Quantitative summary' })
    expect(
      await within(region).findByRole('treegrid', { name: 'TE classification' }),
    ).toBeInTheDocument()
    expect(within(region).getByText('Copia')).toBeInTheDocument()
    expect(within(region).getByText('147519 bp ( 14.75 %)')).toBeInTheDocument()
    // only genomes with a summary in the selector (not the pan-genome library)
    const select = within(region).getByRole('combobox', { name: 'Genome' })
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Col.test.fa',
      'Ler.test.fa',
    ])
    await userEvent.setup().selectOptions(select, '1')
    expect(await within(region).findByText('100000 bp ( 10.00 %)')).toBeInTheDocument()
  })

  it('normal genome: interactive charts, images on request, files with the folder path', async () => {
    renderReport(REPORT)
    expect(await screen.findByRole('treegrid', { name: 'TE classification' })).toBeInTheDocument()
    const dist = section('Distribution of TEs')
    expect(within(dist).getByRole('radio', { name: 'Interactive' })).toBeChecked()
    expect(within(dist).getAllByTestId('katu-chart')).toHaveLength(2)
    expect(await within(section('LTR phylogeny')).findByTestId('katu-chart')).toBeInTheDocument()
    expect(screen.queryByText(/Large genome/)).not.toBeInTheDocument()
    expect(
      within(section('Annotated files')).getByText('/data/results/TAIR10_chr1_1'),
    ).toBeInTheDocument()
  })

  it('large genome: only static images, with a notice and where the files are', async () => {
    const big = lite.replace('30427671 bp', '2000000000 bp')
    renderReport({ ...REPORT, 'REPORT/TAIR10_chr1.fa.mod-LITE.tbl': big })
    const notice = await screen.findByRole('note')
    expect(notice).toHaveTextContent('Large genome (2.00 Gb)')
    expect(notice).toHaveTextContent('/data/results/TAIR10_chr1_1')
    // only the donut of the summary, drawn from two numbers of the table header
    const charts = screen.queryAllByTestId('katu-chart')
    expect(charts).toHaveLength(1)
    expect(charts[0]).toHaveAttribute('data-title', 'Genome masked by repeats')
    expect(screen.queryByRole('radio', { name: 'Interactive' })).not.toBeInTheDocument()
    expect(
      within(section('Distribution of TEs')).getByRole('img', { name: 'TE-Report-bar' }),
    ).toBeInTheDocument()
  })

  it('tree with too many leaves: image with the reason', async () => {
    const leaves = Array.from({ length: 701 }, (_, i) => `T${i}:0.1`).join(',')
    renderReport({ ...REPORT, 'REPORT/TREE/all.nwk': `(${leaves});` })
    const tree = await screen.findByRole('region', { name: 'LTR phylogeny' })
    expect(await within(tree).findByText(/701 LTR elements \(limit 700/)).toBeInTheDocument()
    expect(
      within(tree).getByRole('img', { name: 'LTR_RT-Tree1_original_circular' }),
    ).toBeInTheDocument()
  })

  it('big data file: no download for the interactive chart', async () => {
    const spy = vi.spyOn(FilesService.prototype, 'readText')
    renderReport({ ...REPORT, 'REPORT/TREE/all.nwk': `(${'a,'.repeat(600_000)}b);` })
    expect(await screen.findByText(/all\.nwk has 1\.1 MB/)).toBeInTheDocument()
    expect(spy.mock.calls.map((c) => c[1])).not.toContain('REPORT/TREE/all.nwk')
  })
})
