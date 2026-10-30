import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, ExternalLink, FolderOpen, Info } from 'lucide-react'
import type { RunFile, RunSummary } from '../types'
import {
  INTERACTIVE_LIMITS as LIMITS,
  REPORT_SECTIONS,
  buildReport,
  type ReportManifest,
  type ReportSectionId,
} from '../config/reportSections'
import { usePipelineService } from '../state/hooks'
import { formatBp, formatBytes } from '../utils/files'
import { useRunText, type TextState } from './useRunText'
import { parseTEReport, type TESelection } from './parse/teReport'
import { parseDivsum } from './parse/divsum'
import { parseInsertionAges } from './parse/insertionTime'
import { countLeaves } from './parse/newick'
import { ReportSection, type SectionMode } from './ReportSection'
import { ImageGallery } from './ImageGallery'
import { TETable } from './TETable'
import { TECharts } from './charts/TECharts'
import { RepeatLandscapeChart } from './charts/RepeatLandscapeChart'
import { InsertionTimeChart } from './charts/InsertionTimeChart'
import { PhyloTreeChart } from './charts/PhyloTreeChart'
import { MaskedDonutChart } from './charts/MaskedDonutChart'
import styles from './Report.module.scss'

const DEF = Object.fromEntries(REPORT_SECTIONS.map((s) => [s.id, s])) as Record<
  ReportSectionId,
  (typeof REPORT_SECTIONS)[number]
>

type Listing =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; files: RunFile[] }

/** null when the file is within the limit; otherwise the reason shown to the user. */
function tooBig(m: ReportManifest, path: string | null, limit: number): string | null {
  if (!path) return null
  const size = m.sizes[path] ?? 0
  if (size <= limit) return null
  const name = path.slice(path.lastIndexOf('/') + 1)
  return `${name} has ${formatBytes(size)} (limit ${formatBytes(limit)} for interactive charts).`
}

/** Path only when it may be fetched (exists and is within the size limit). */
const fetchable = (m: ReportManifest, path: string | null, limit: number) =>
  path && !tooBig(m, path, limit) ? path : null

function useMode(available: boolean): [SectionMode, (m: SectionMode) => void] {
  const [mode, setMode] = useState<SectionMode>('interactive')
  return [available ? mode : 'images', setMode]
}

function Loading({ state, children }: { state: TextState; children: (text: string) => ReactNode }) {
  if (state.status === 'loading') return <p className={styles.muted}>Loading…</p>
  if (state.status === 'error') return <p className={styles.error}>{state.message}</p>
  return <>{children(state.text)}</>
}

export function ReportView({ runId, summary }: { runId: string; summary: RunSummary | null }) {
  const service = usePipelineService()
  const [listing, setListing] = useState<{ runId: string; value: Listing } | null>(null)
  const running = summary?.status === 'running'

  useEffect(() => {
    let cancelled = false
    service
      .listReportFiles(runId)
      .then((files) => !cancelled && setListing({ runId, value: { status: 'ready', files } }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setListing({
            runId,
            value: { status: 'error', message: e instanceof Error ? e.message : String(e) },
          }),
      )
    return () => {
      cancelled = true
    }
  }, [service, runId, running])

  const current = listing?.runId === runId ? listing.value : null
  const manifest = useMemo(
    () => (current?.status === 'ready' ? buildReport(current.files) : null),
    [current],
  )
  const state: Listing = current ?? { status: 'loading' }

  if (state.status === 'loading') return <p className={styles.placeholder}>Loading the report…</p>
  if (state.status === 'error')
    return <p className={`${styles.placeholder} ${styles.error}`}>{state.message}</p>
  return <Report runId={runId} summary={summary} m={manifest!} />
}

function Report({
  runId,
  summary,
  m,
}: {
  runId: string
  summary: RunSummary | null
  m: ReportManifest
}) {
  const service = usePipelineService()
  const lite = useRunText(runId, fetchable(m, m.liteTable, LIMITS.tableFileBytes))
  const parsedLite = useMemo(
    () => (lite.status === 'ready' ? parseTEReport(lite.text) : null),
    [lite],
  )
  const genomeBp = parsedLite?.meta.totalLengthBp ?? null
  const largeGenome = genomeBp !== null && genomeBp > LIMITS.genomeBp
  const [genomeIdx, setGenomeIdx] = useState(0)
  const [teSelection, setTeSelection] = useState<TESelection | null>(null)

  // what each interactive chart needs, already checked against the limits
  const divsumPath = largeGenome ? null : fetchable(m, m.divsum, LIMITS.tableFileBytes)
  const copiaPath = largeGenome ? null : fetchable(m, m.ageCopia, LIMITS.ageFileBytes)
  const gypsyPath = largeGenome ? null : fetchable(m, m.ageGypsy, LIMITS.ageFileBytes)
  const treePath = largeGenome ? null : fetchable(m, m.tree, LIMITS.treeFileBytes)
  const clsPath = largeGenome ? null : fetchable(m, m.treeClassification, LIMITS.treeFileBytes)

  const divsum = useRunText(runId, divsumPath)
  const copia = useRunText(runId, copiaPath)
  const gypsy = useRunText(runId, gypsyPath)
  const newick = useRunText(runId, treePath)
  const cls = useRunText(runId, clsPath)
  const leaves = newick.status === 'ready' ? countLeaves(newick.text) : null
  const treeTooBig = leaves !== null && leaves > LIMITS.treeLeaves

  const [distMode, setDistMode] = useMode(!largeGenome && !!parsedLite?.tree.length)
  const [landMode, setLandMode] = useMode(!!divsumPath && genomeBp !== null)
  const [ageMode, setAgeMode] = useMode(!!(copiaPath || gypsyPath))
  const [treeMode, setTreeMode] = useMode(!!treePath && !treeTooBig)

  const genome = m.genomes[Math.min(genomeIdx, m.genomes.length - 1)] ?? null
  const teSum = useRunText(
    runId,
    parsedLite ? null : fetchable(m, genome?.teSum ?? null, LIMITS.tableFileBytes),
  )

  const nothing =
    !m.liteTable && !m.genomes.length && !Object.keys(m.images).length && !m.reportTables.length
  if (nothing) {
    return (
      <p className={styles.placeholder}>
        {summary?.status === 'running'
          ? 'The report is built from the output files: they appear here as the run produces them.'
          : 'No output file for the report was found in this run folder.'}
      </p>
    )
  }

  const largeNote = (what: string | null) =>
    largeGenome ? 'Large genome: shown as the static image made by the pipeline.' : what

  return (
    <div className={styles.report}>
      {largeGenome && genomeBp !== null && (
        <div className={styles.banner} role="note">
          <Info size={16} aria-hidden="true" />
          <div>
            <p>
              <b>Large genome ({formatBp(genomeBp)}).</b> To keep the browser responsive, the charts
              are shown as the static images made by the pipeline, not as interactive charts.
            </p>
            {summary?.path && (
              <p>
                All result files are on the machine that ran the annotation, in{' '}
                <code>{summary.path}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 1. Quantitative summary */}
      {(m.liteTable || genome?.teSum) && (
        <ReportSection
          def={DEF.summary}
          note={parsedLite ? null : tooBig(m, m.liteTable, LIMITS.tableFileBytes)}
          actions={
            m.genomes.length > 1 && !parsedLite ? (
              <select
                className={styles.select}
                aria-label="Genome"
                value={genomeIdx}
                onChange={(e) => setGenomeIdx(Number(e.target.value))}
              >
                {m.genomes.map((g, i) => (
                  <option key={g.name} value={i}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null
          }
        >
          {parsedLite ? (
            parsedLite.tree.length ? (
              <div className={styles.summaryGrid}>
                <MaskedDonutChart
                  meta={parsedLite.meta}
                  selection={teSelection}
                  onReset={() => setTeSelection(null)}
                />
                <TETable
                  meta={parsedLite.meta}
                  tree={parsedLite.tree}
                  selectedKey={teSelection?.key ?? null}
                  onSelect={(sel) => setTeSelection((prev) => (prev?.key === sel.key ? null : sel))}
                />
              </div>
            ) : (
              <p className={styles.muted}>The table has no TE category.</p>
            )
          ) : m.liteTable &&
            lite.status !== 'ready' &&
            !tooBig(m, m.liteTable, LIMITS.tableFileBytes) ? (
            <Loading state={lite}>{() => null}</Loading>
          ) : genome?.teSum ? (
            <Loading state={teSum}>{(text) => <pre className={styles.pre}>{text}</pre>}</Loading>
          ) : (
            <p className={styles.muted}>Download the table in “Annotated files”.</p>
          )}
        </ReportSection>
      )}

      {/* 2. Distribution of TEs */}
      {(parsedLite?.tree.length || m.images.distribution) && (
        <ReportSection
          def={DEF.distribution}
          mode={
            parsedLite?.tree.length && m.images.distribution && !largeGenome
              ? { value: distMode, onChange: setDistMode }
              : undefined
          }
          note={largeNote(null)}
        >
          {distMode === 'interactive' && parsedLite ? (
            <TECharts tree={parsedLite.tree} />
          ) : m.images.distribution ? (
            <ImageGallery runId={runId} images={m.images.distribution} />
          ) : null}
        </ReportSection>
      )}

      {/* 3. Repeat landscape */}
      {(m.divsum || m.images.landscape) && (
        <ReportSection
          def={DEF.landscape}
          mode={
            divsumPath && genomeBp !== null && m.images.landscape
              ? { value: landMode, onChange: setLandMode }
              : undefined
          }
          note={largeNote(tooBig(m, m.divsum, LIMITS.tableFileBytes))}
          actions={
            m.landscapeHtml && (
              <a
                className={styles.action}
                href={service.fileUrl(runId, m.landscapeHtml, true)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} aria-hidden="true" /> RepeatLandscape.html
              </a>
            )
          }
        >
          {landMode === 'interactive' && divsumPath && genomeBp !== null ? (
            <Loading state={divsum}>
              {(text) => {
                const table = parseDivsum(text)
                return table ? (
                  <RepeatLandscapeChart table={table} genomeBp={genomeBp} />
                ) : (
                  <p className={styles.muted}>No divergence table in the .divsum file.</p>
                )
              }}
            </Loading>
          ) : m.images.landscape ? (
            <ImageGallery runId={runId} images={m.images.landscape} />
          ) : (
            <p className={styles.muted}>The genome size is needed to draw this chart.</p>
          )}
        </ReportSection>
      )}

      {/* 4. Chromosomes (images only) */}
      {m.images.chromosomes && (
        <ReportSection
          def={DEF.chromosomes}
          actions={
            m.chromosomePdf && (
              <a
                className={styles.action}
                href={service.fileUrl(runId, m.chromosomePdf, true)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} aria-hidden="true" /> All chromosomes (PDF)
              </a>
            )
          }
        >
          <ImageGallery runId={runId} images={m.images.chromosomes} />
        </ReportSection>
      )}

      {/* 5. LTR insertion time */}
      {(m.ageCopia || m.ageGypsy || m.images.age) && (
        <ReportSection
          def={DEF.age}
          mode={
            (copiaPath || gypsyPath) && m.images.age
              ? { value: ageMode, onChange: setAgeMode }
              : undefined
          }
          note={largeNote(
            tooBig(m, m.ageCopia, LIMITS.ageFileBytes) ??
              tooBig(m, m.ageGypsy, LIMITS.ageFileBytes),
          )}
        >
          {ageMode === 'interactive' && (copiaPath || gypsyPath) ? (
            <div className={styles.twoCols}>
              {copiaPath && (
                <Loading state={copia}>
                  {(t) => (
                    <InsertionTimeChart
                      ages={parseInsertionAges(t)}
                      title="LTR Copia insertion time"
                      color="#e8736b"
                    />
                  )}
                </Loading>
              )}
              {gypsyPath && (
                <Loading state={gypsy}>
                  {(t) => (
                    <InsertionTimeChart
                      ages={parseInsertionAges(t)}
                      title="LTR Gypsy insertion time"
                      color="#3a8fa8"
                    />
                  )}
                </Loading>
              )}
            </div>
          ) : m.images.age ? (
            <ImageGallery runId={runId} images={m.images.age} />
          ) : null}
        </ReportSection>
      )}

      {/* 6. LTR phylogeny */}
      {(m.tree || m.images.phylogeny) && (
        <ReportSection
          def={DEF.phylogeny}
          mode={
            treePath && !treeTooBig && m.images.phylogeny
              ? { value: treeMode, onChange: setTreeMode }
              : undefined
          }
          note={largeNote(
            tooBig(m, m.tree, LIMITS.treeFileBytes) ??
              (treeTooBig
                ? `The tree has ${leaves} LTR elements (limit ${LIMITS.treeLeaves} for the interactive tree).`
                : null),
          )}
        >
          {treeMode === 'interactive' && treePath && !treeTooBig ? (
            <Loading state={newick}>
              {(text) =>
                clsPath && cls.status === 'loading' ? (
                  <p className={styles.muted}>Loading…</p>
                ) : (
                  <PhyloTreeChart
                    newick={text}
                    classification={cls.status === 'ready' ? cls.text : null}
                  />
                )
              }
            </Loading>
          ) : m.images.phylogeny ? (
            <ImageGallery runId={runId} images={m.images.phylogeny} />
          ) : null}
        </ReportSection>
      )}

      {/* 7. Files */}
      <ReportSection def={DEF.files}>
        {summary?.path && (
          <p className={styles.location}>
            <FolderOpen size={14} aria-hidden="true" />
            <span>
              All files of this run are on the machine that ran the annotation, in{' '}
              <code>{summary.path}</code>
            </span>
          </p>
        )}
        <div className={styles.fileGroups}>
          {m.genomes.map((g) => (
            <FileGroup key={g.name} title={g.name} runId={runId} items={g.downloads} />
          ))}
          {m.reportTables.length > 0 && (
            <FileGroup title="Report data (REPORT/)" runId={runId} items={m.reportTables} />
          )}
        </div>
      </ReportSection>
    </div>
  )
}

function FileGroup({
  title,
  runId,
  items,
}: {
  title: string
  runId: string
  items: { path: string; label: string; size: number }[]
}) {
  const service = usePipelineService()
  return (
    <div className={styles.fileGroup}>
      <h4>{title}</h4>
      <ul>
        {items.map((d) => (
          <li key={d.path}>
            <a href={service.fileUrl(runId, d.path)} download>
              <Download size={13} aria-hidden="true" />
              <span>{d.label}</span>
            </a>
            <span className={styles.fileMeta} title={d.path}>
              {d.path.slice(d.path.lastIndexOf('/') + 1)} · {formatBytes(d.size)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
