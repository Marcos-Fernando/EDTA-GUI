/**
 * Report view: which files of a run folder feed each section.
 * Names come from AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh (REPORT/) and from
 * EDTA.pl / panEDTA.sh (outputs at the top of the run folder).
 */
import type { RunFile } from '../types'

export type ReportSectionId =
  'summary' | 'distribution' | 'landscape' | 'chromosomes' | 'age' | 'phylogeny' | 'files'

export interface ReportSectionDef {
  id: ReportSectionId
  title: string
  subtitle: string
}

export const REPORT_SECTIONS: readonly ReportSectionDef[] = [
  {
    id: 'summary',
    title: 'Quantitative summary',
    subtitle: 'Transposable element classes found in the genome (RepeatMasker table).',
  },
  {
    id: 'distribution',
    title: 'Distribution of TEs',
    subtitle: 'Length occupied and number of copies per TE category.',
  },
  {
    id: 'landscape',
    title: 'Repeat landscape',
    subtitle: 'Genome fraction by Kimura substitution level.',
  },
  {
    id: 'chromosomes',
    title: 'Distribution by chromosome',
    subtitle: 'TE density along each chromosome or scaffold.',
  },
  {
    id: 'age',
    title: 'LTR insertion time',
    subtitle: 'Age estimates of the Copia and Gypsy superfamilies.',
  },
  {
    id: 'phylogeny',
    title: 'LTR phylogeny',
    subtitle: 'Phylogenetic relationships of the LTR retrotransposon lineages.',
  },
  {
    id: 'files',
    title: 'Annotated files',
    subtitle: 'Main outputs of the annotation, per genome.',
  },
]

/** Static images per section (PNG in REPORT/, with a PDF of the same name when present). */
const IMAGE_PATTERNS: Partial<Record<ReportSectionId, RegExp>> = {
  distribution: /^REPORT\/TE-Report.*\.png$/,
  landscape: /^REPORT\/kimura_distance_plot\.png$/,
  chromosomes: /^REPORT\/density_plot_.+\.png$/,
  age: /^REPORT\/AGE-.+\.png$/,
  phylogeny: /^REPORT\/LTR_RT-Tree.+\.png$/,
}

/** Main outputs offered for download, in display order. */
const OUTPUTS: readonly { suffix: RegExp; label: string }[] = [
  { suffix: /\.mod\.EDTA\.TEanno\.gff3$/, label: 'Whole-genome TE annotation (GFF3)' },
  { suffix: /\.mod\.EDTA\.intact\.gff3$/, label: 'Intact TEs (GFF3)' },
  { suffix: /\.mod\.EDTA\.TElib\.fa$/, label: 'TE library (FASTA)' },
  { suffix: /\.mod\.EDTA\.TElib\.novel\.fa$/, label: 'Novel TEs in the library (FASTA)' },
  { suffix: /\.mod\.EDTA\.intact\.fa$/, label: 'Intact TEs (FASTA)' },
  { suffix: /\.mod-Softmasked\.fa$/, label: 'Softmasked genome (FASTA)' },
  { suffix: /\.mod\.MAKER\.masked$/, label: 'Masked genome for MAKER (FASTA)' },
  { suffix: /\.mod\.EDTA\.TEanno\.sum$/, label: 'Annotation summary' },
  { suffix: /\.mod\.LAI$/, label: 'LAI report' },
  { suffix: /\.mod\.panEDTA\.out\.gff$/, label: 'panEDTA annotation (GFF)' },
  { suffix: /\.mod\.panEDTA\.tbl$/, label: 'panEDTA summary table' },
  { suffix: /\.panEDTA\.TElib\.fa$/, label: 'Pan-genome TE library (FASTA)' },
  { suffix: /\.mod\.EDTA\.TEanno\.density_plots\.pdf$/, label: 'TE density plots (PDF)' },
  { suffix: /\.mod_divergence_plot.*\.pdf$/, label: 'Divergence plot (PDF)' },
]

/** panEDTA keeps backups such as "x.gff3_20261006_160709": not offered. */
const BACKUP = /_\d{8}_\d{6}$/

export interface ReportImage {
  png: string
  pdf: string | null
  /** File name without folder and extension. */
  name: string
}

export interface ReportDownload {
  path: string
  label: string
  size: number
}

export interface ReportGenome {
  /** Genome file name (e.g. TAIR10_chr1.fa), or "Pan-genome" for pan-wide files. */
  name: string
  downloads: ReportDownload[]
  /** EDTA annotation summary (*.mod.EDTA.TEanno.sum), when present. */
  teSum: string | null
}

export interface ReportManifest {
  /** RepeatMasker tables from the AnnoTEP report. */
  liteTable: string | null
  completeTable: string | null
  divsum: string | null
  landscapeHtml: string | null
  chromosomePdf: string | null
  ageCopia: string | null
  ageGypsy: string | null
  tree: string | null
  treeClassification: string | null
  images: Partial<Record<ReportSectionId, ReportImage[]>>
  genomes: ReportGenome[]
  /** Extra REPORT/ tables offered for download. */
  reportTables: ReportDownload[]
  /** Size in bytes of every listed file. */
  sizes: Record<string, number>
}

const first = (paths: string[], re: RegExp) => paths.find((p) => re.test(p)) ?? null

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Genome a top-level output belongs to: everything before ".mod" (or the pan library). */
function genomeOf(name: string): string {
  const i = name.indexOf('.mod')
  return i > 0 ? name.slice(0, i) : 'Pan-genome'
}

export function buildReport(files: RunFile[]): ReportManifest {
  const paths = files.map((f) => f.path)
  const has = new Set(paths)
  const size = new Map(files.map((f) => [f.path, f.size]))

  const images: ReportManifest['images'] = {}
  for (const [id, re] of Object.entries(IMAGE_PATTERNS) as [ReportSectionId, RegExp][]) {
    const found = paths
      .filter((p) => re.test(p))
      .map((png) => {
        const pdf = png.replace(/\.png$/, '.pdf')
        return { png, pdf: has.has(pdf) ? pdf : null, name: baseName(png).replace(/\.png$/, '') }
      })
    if (found.length) images[id] = found
  }

  const byGenome = new Map<string, ReportGenome>()
  for (const { suffix, label } of OUTPUTS) {
    for (const path of paths) {
      if (path.includes('/') || BACKUP.test(path) || !suffix.test(path)) continue
      const name = genomeOf(path)
      const g = byGenome.get(name) ?? { name, downloads: [], teSum: null }
      if (g.downloads.some((d) => d.path === path)) continue
      g.downloads.push({ path, label, size: size.get(path) ?? 0 })
      if (/\.mod\.EDTA\.TEanno\.sum$/.test(path)) g.teSum = path
      byGenome.set(name, g)
    }
  }
  // genomes first, the pan-wide library last
  const genomes = [...byGenome.values()].sort(
    (a, b) => Number(a.name === 'Pan-genome') - Number(b.name === 'Pan-genome'),
  )

  const reportTables = [
    [/^REPORT\/[^/]+-COMPLETE\.tbl$/, 'TE classification, complete table'],
    [/^REPORT\/[^/]+-LITE\.tbl$/, 'TE classification, simplified table'],
    [/^REPORT\/[^/]+\.divsum$/, 'Divergence summary (RepeatMasker .divsum)'],
    [/^REPORT\/TREE\/all\.nwk$/, 'LTR tree (Newick)'],
    [/^REPORT\/TREE\/TE\.cls\.tsv$/, 'LTR classification (TEsorter)'],
  ]
    .map(([re, label]) => {
      const path = first(paths, re as RegExp)
      return path ? { path, label: label as string, size: size.get(path) ?? 0 } : null
    })
    .filter((d): d is ReportDownload => d !== null)

  return {
    liteTable: first(paths, /^REPORT\/[^/]+-LITE\.tbl$/),
    completeTable: first(paths, /^REPORT\/[^/]+-COMPLETE\.tbl$/),
    divsum: first(paths, /^REPORT\/[^/]+\.divsum$/),
    landscapeHtml: first(paths, /^REPORT\/RepeatLandscape\.html$/),
    chromosomePdf: first(paths, /^REPORT\/chromosome_density_plots\.pdf$/),
    ageCopia: first(paths, /^REPORT\/AGE-Copia\.txt$/),
    ageGypsy: first(paths, /^REPORT\/AGE-Gypsy\.txt$/),
    tree: first(paths, /^REPORT\/TREE\/all\.nwk$/),
    treeClassification: first(paths, /^REPORT\/TREE\/TE\.cls\.tsv$/),
    images,
    genomes,
    reportTables,
    sizes: Object.fromEntries(size),
  }
}

/**
 * Large genomes: above these limits a section shows only the static images made by the
 * pipeline, so the browser never downloads or draws data that could freeze the machine.
 * File sizes are checked before anything is fetched; the leaf count after reading the tree.
 */
export const INTERACTIVE_LIMITS = {
  /** Genome size (bp, from the RepeatMasker table): above it the whole report uses images. */
  genomeBp: 1_000_000_000,
  /** AGE-Copia.txt / AGE-Gypsy.txt (one line per LTR element). */
  ageFileBytes: 1_000_000,
  /** TREE/all.nwk and TE.cls.tsv. */
  treeFileBytes: 1_000_000,
  /** Leaves of the LTR tree. */
  treeLeaves: 700,
  /** RepeatMasker tables and .divsum (small even for big genomes; guard anyway). */
  tableFileBytes: 2_000_000,
} as const
