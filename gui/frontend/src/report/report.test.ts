import { describe, expect, it } from 'vitest'
import lite from './__fixtures__/lite.tbl?raw'
import divsumRaw from './__fixtures__/sample.divsum?raw'
import ageRaw from './__fixtures__/age-copia.txt?raw'
import nwk from './__fixtures__/all.nwk?raw'
import clsRaw from './__fixtures__/te.cls.tsv?raw'
import {
  getChartLabel,
  getGeneralCategories,
  getLeafCategories,
  parseTEReport,
  type TENode,
} from './parse/teReport'
import { normalizeDivsum, parseDivsum, stackedAxisMax } from './parse/divsum'
import { buildHistogram, mean, median, parseInsertionAges } from './parse/insertionTime'
import {
  cladeOf,
  countLeaves,
  getLeaves,
  midpointRoot,
  parseClassification,
  parseNewick,
} from './parse/newick'
import { buildReport } from '../config/reportSections'
import { radialTreeSize } from './charts/phyloLayout'
import type { RunFile } from '../types'

describe('report parsers (real TAIR10 chr1 outputs)', () => {
  it('reads the RepeatMasker TE table as a tree', () => {
    const { meta, tree } = parseTEReport(lite)
    expect(meta.totalLengthBp).toBe(30427671)
    expect(meta.basesMasked).toMatch(/^3615303 bp/)
    expect(meta.basesMaskedBp).toBe(3615303)
    const names = tree.map((n) => n.name)
    expect(names).toContain('Class I Total')
    expect(names).toContain('Unclassified')
    const general = getGeneralCategories(tree).map((n) => n.name)
    expect(general).toEqual(expect.arrayContaining(['Non-LTR', 'LTR/Copia', 'Unclassified']))
    const leaves = getLeafCategories(tree)
    expect(leaves.length).toBeGreaterThan(5)
    expect(leaves.every((n) => (n.elements ?? 0) > 0)).toBe(true)
  })

  it('leaves out nested Unclassified/Unknown and shortens chart labels', () => {
    const node = (name: string, elements: number, children: TENode[] = []): TENode => ({
      name,
      elements,
      lengthBp: elements * 1000,
      percentage: 1,
      children,
    })
    const tree = [
      node('LTR/Copia', 5, [node('Ale', 3), node('Unclassified', 2)]),
      node('TIRs', 4, [node('EnSpm_CACTA', 3), node('Unknown', 1)]),
      node('Unclassified', 7),
    ]
    expect(getLeafCategories(tree).map((n) => n.name)).toEqual([
      'Ale',
      'EnSpm_CACTA',
      'Unclassified',
    ])
    expect(getChartLabel('EnSpm_CACTA')).toBe('CACTA')
    expect(getChartLabel('Ale')).toBe('Ale')
  })

  it('reads the .divsum table and normalizes by genome size', () => {
    const table = parseDivsum(divsumRaw)!
    expect(table.classes).toEqual(['LTR/Copia', 'TIR'])
    expect(table.rows[0]).toEqual({ div: 0, values: { 'LTR/Copia': 104295, TIR: 16267 } })
    const [copia] = normalizeDivsum(table, 30427671)
    expect(copia.data[0][1]).toBeCloseTo((104295 / 30427671) * 100, 6)
  })

  it('puts the top of the Y axis above the tallest stacked column', () => {
    const series = [
      {
        data: [
          [0, 0.75],
          [1, 0.1],
        ] as [number, number][],
      },
      {
        data: [
          [0, 0.33],
          [1, 0.05],
        ] as [number, number][],
      },
    ]
    // tallest column: 0.75 + 0.33 = 1.08 → with room, rounded up to 1.2
    expect(stackedAxisMax(series)).toBeCloseTo(1.2, 6)
    expect(stackedAxisMax(series)).toBeGreaterThan(1.08)
    expect(stackedAxisMax([])).toBe(1)
  })

  it('reads insertion ages in Mya', () => {
    const ages = parseInsertionAges(ageRaw)
    expect(ages).toHaveLength(21)
    expect(ages[0]).toBeCloseTo(1.212196, 6)
    expect(median(ages)).toBeGreaterThan(0)
    const hist = buildHistogram(ages)
    // density integrates to 1 (binwidth 0.1)
    expect(hist.reduce((s, b) => s + b.density * 0.1, 0)).toBeCloseTo(1, 6)
    expect(mean(ages)).toBeGreaterThan(0)
  })

  it('parses the LTR tree, roots it at the midpoint and finds clades', () => {
    const root = parseNewick(nwk)
    const n = getLeaves(root).length
    expect(countLeaves(nwk)).toBe(n)
    expect(getLeaves(midpointRoot(root))).toHaveLength(n)
    const cls = parseClassification(clsRaw)
    expect(cladeOf('TE_00000006#LTR/Copia/Ale', cls)).toBe('Ale')
    expect(cladeOf('X_1#LTR/Gypsy/Tekay', new Map())).toBe('Tekay')
  })
})

const f = (path: string, size = 100): RunFile => ({ path, size, modifiedAt: '' })

describe('buildReport', () => {
  it('groups AnnoTEP outputs by section and genome', () => {
    const m = buildReport([
      f('TAIR10_chr1.fa.mod.EDTA.TEanno.gff3', 5000),
      f('TAIR10_chr1.fa.mod-Softmasked.fa'),
      f('TAIR10_chr1.fa.mod.EDTA.TEanno.sum'),
      f('log.txt'),
      f('REPORT/TAIR10_chr1.fa.mod-LITE.tbl'),
      f('REPORT/TAIR10_chr1.divsum'),
      f('REPORT/TE-Report-bar.png'),
      f('REPORT/TE-Report-bar.pdf'),
      f('REPORT/density_plot_Chr1.png'),
      f('REPORT/AGE-Copia.txt'),
      f('REPORT/LTR_RT-Tree1_original_circular.png'),
      f('REPORT/TREE/LTR_RT-Tree1_original_circular.png'),
      f('REPORT/TREE/all.nwk'),
    ])
    expect(m.liteTable).toBe('REPORT/TAIR10_chr1.fa.mod-LITE.tbl')
    expect(m.images.distribution).toEqual([
      { png: 'REPORT/TE-Report-bar.png', pdf: 'REPORT/TE-Report-bar.pdf', name: 'TE-Report-bar' },
    ])
    // TREE/ copies are not shown twice
    expect(m.images.phylogeny).toHaveLength(1)
    expect(m.genomes).toHaveLength(1)
    expect(m.genomes[0].name).toBe('TAIR10_chr1.fa')
    expect(m.genomes[0].downloads.map((d) => d.label)).toEqual([
      'Whole-genome TE annotation (GFF3)',
      'Softmasked genome (FASTA)',
      'Annotation summary',
    ])
    expect(m.sizes['TAIR10_chr1.fa.mod.EDTA.TEanno.gff3']).toBe(5000)
  })

  it('panEDTA: one group per genome, pan library last, backups skipped', () => {
    const m = buildReport([
      f('genome_1.cds.list.panEDTA.TElib.fa'),
      f('Col.test.fa.mod.EDTA.TEanno.gff3'),
      f('Col.test.fa.mod.EDTA.TEanno.gff3_20261006_160709'),
      f('Ler.test.fa.mod.panEDTA.out.gff'),
    ])
    expect(m.genomes.map((g) => g.name)).toEqual(['Col.test.fa', 'Ler.test.fa', 'Pan-genome'])
    expect(m.genomes[0].downloads).toHaveLength(1)
  })
})

describe('radialTreeSize', () => {
  it('leaves room outside the circle for the longest leaf label', () => {
    const short = radialTreeSize(['a', 'b'])
    const long = radialTreeSize(['TE_00000174_LTR_Copia_Bianca', 'b'])
    expect(long.spacing).toBeGreaterThan(short.spacing)
    expect(long.size - short.size).toBe(2 * (long.spacing - short.spacing))
  })

  it('grows the circle with the number of leaves', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `TE_${i}`)
    expect(radialTreeSize(names(700)).size).toBeGreaterThan(radialTreeSize(names(125)).size)
  })
})
