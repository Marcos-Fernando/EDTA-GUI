import { lazy, Suspense, useEffect, useState } from 'react'
import { Activity, ArrowLeft, ChartColumn } from 'lucide-react'
import type { RunSummary } from '../types'
import { RunWorkspace } from '../components/RunWorkspace'
import { FolderPath } from '../components/FolderPath'
import { hrefFor, type RunTab } from '../hooks/useHashRoute'
import { usePipelineService } from '../state/hooks'
import styles from './ResultsPage.module.scss'

// charts library only loads when the report is opened
const ReportView = lazy(() =>
  import('../report/ReportView').then((m) => ({ default: m.ReportView })),
)

const UNKNOWN = { kind: 'unknown', step: 'all', anno: true, evaluate: true, runLai: true } as const

/** A run opened from Results: execution (timeline + console) or report (charts and files). */
export function RunPage({ runId, tab }: { runId: string; tab: RunTab }) {
  return (
    <div className={styles.runPage}>
      <div className={styles.runBar}>
        <a className={styles.back} href={hrefFor({ page: 'results' })}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to results
        </a>
        <nav className={styles.views} aria-label="Run views">
          <a
            href={hrefFor({ page: 'run', runId })}
            aria-current={tab === 'execution' ? 'page' : undefined}
          >
            <Activity size={13} aria-hidden="true" /> Execution
          </a>
          <a
            href={hrefFor({ page: 'run', runId, tab: 'report' })}
            aria-current={tab === 'report' ? 'page' : undefined}
          >
            <ChartColumn size={13} aria-hidden="true" /> Report
          </a>
        </nav>
      </div>
      {tab === 'report' ? (
        <ReportPage runId={runId} />
      ) : (
        <RunWorkspace runId={runId} eyebrow="Run folder" title={runId} idleContext={UNKNOWN} />
      )}
    </div>
  )
}

function ReportPage({ runId }: { runId: string }) {
  const service = usePipelineService()
  const [summary, setSummary] = useState<RunSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    service
      .getRun(runId)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [service, runId])

  return (
    <div className={styles.reportPage}>
      <div className={styles.reportHead}>
        <p className={styles.eyebrow}>Run folder</p>
        <h2>{runId}</h2>
        {summary?.path && <FolderPath path={summary.path} />}
      </div>
      <Suspense fallback={<p className={styles.empty}>Loading the report…</p>}>
        <ReportView runId={runId} summary={summary} />
      </Suspense>
    </div>
  )
}
