import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'
import { HelpPopover } from '../components/HelpPopover'
import { LogConsole } from '../components/LogConsole'
import { hrefFor } from '../hooks/useHashRoute'
import { useNow } from '../hooks/useNow'
import { useRuns } from '../hooks/useRuns'
import { KIND_LABEL, sortRuns, statusView } from '../utils/runs'
import { durationBetween, formatDateTime, formatDuration } from '../utils/time'
import styles from './ResultsPage.module.scss'

/** The legacy page listed the 10 most recent runs. */
const PAGE_SIZE = 10

export function ResultsPage() {
  const { runs, error, refresh } = useRuns()
  const [openLogs, setOpenLogs] = useState<Set<string>>(() => new Set())
  const [showAll, setShowAll] = useState(false)
  const sorted = sortRuns(runs ?? [])
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE)
  const now = useNow(sorted.some((r) => r.status === 'running'))

  const toggle = (id: string) =>
    setOpenLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Results</p>
          <h2>
            Latest activities <HelpPopover topic="results" />
          </h2>
          <p className={styles.sub}>
            Runs in progress first, then the most recent. Refreshed every 10 seconds.
          </p>
        </div>
        <button type="button" className={styles.refresh} onClick={refresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          Could not load the runs: {error}
        </p>
      )}

      {runs === null && !error ? (
        <p className={styles.empty}>Loading runs…</p>
      ) : sorted.length === 0 ? (
        <p className={styles.empty}>No run found in the results directory.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Run folder</th>
                <th scope="col">Pipeline</th>
                <th scope="col">Status</th>
                <th scope="col">Started</th>
                <th scope="col">Finished</th>
                <th scope="col">Duration</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((run) => {
                const view = statusView(run)
                const open = openLogs.has(run.id)
                const logId = `log-${run.id}`
                const duration = durationBetween(run.startedAt, run.finishedAt, now)
                return (
                  <Fragment key={run.id}>
                    <tr>
                      <th scope="row" className={styles.name}>
                        {run.id}
                        {run.readOnly && (
                          <span
                            className={styles.readOnly}
                            title="Old results folder: listed only, cannot be continued"
                          >
                            read-only
                          </span>
                        )}
                      </th>
                      <td>{KIND_LABEL[run.kind]}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[view.tone]}`} title={view.note}>
                          {view.label}
                        </span>
                        {view.note && <span className={styles.note}>{view.note}</span>}
                      </td>
                      <td className={styles.mono}>{formatDateTime(run.startedAt)}</td>
                      <td className={styles.mono}>{formatDateTime(run.finishedAt)}</td>
                      <td className={styles.mono}>
                        {duration === null ? '—' : formatDuration(duration)}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            aria-expanded={open}
                            aria-controls={open ? logId : undefined}
                            onClick={() => toggle(run.id)}
                          >
                            {open ? (
                              <ChevronDown size={14} aria-hidden="true" />
                            ) : (
                              <ChevronRight size={14} aria-hidden="true" />
                            )}
                            {open ? 'Hide log' : 'Show log'}
                          </button>
                          <a
                            className={styles.linkBtn}
                            href={hrefFor({ page: 'run', runId: run.id })}
                          >
                            <ExternalLink size={14} aria-hidden="true" /> Open
                          </a>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className={styles.logRow}>
                        <td colSpan={7} id={logId}>
                          <LogConsole
                            className={styles.log}
                            lines={run.lastLogLines}
                            label={`Last log lines of ${run.id}`}
                            follow={false}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > PAGE_SIZE && (
        <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show the ${PAGE_SIZE} most recent` : `Show all runs (${sorted.length})`}
        </button>
      )}
    </div>
  )
}
