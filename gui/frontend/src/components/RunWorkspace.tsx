import { useState, type ReactNode } from 'react'
import { Square } from 'lucide-react'
import type { TimelineContext } from '../types'
import { detectSteps } from '../config/stepMatchers'
import { useRunStream } from '../hooks/useRunStream'
import { useNow } from '../hooks/useNow'
import { usePipelineService } from '../state/hooks'
import { durationBetween, formatDateTime, formatDuration } from '../utils/time'
import { statusView } from '../utils/runs'
import { StatCards, type StatItem } from './StatCards'
import { Timeline } from './Timeline'
import { LogConsole } from './LogConsole'
import { FolderPath } from './FolderPath'
import styles from './RunWorkspace.module.scss'

/** Timeline context of legacy runs without metadata: keep every step the log mentions. */
const UNKNOWN_CTX: TimelineContext = {
  kind: 'unknown',
  step: 'all',
  anno: true,
  evaluate: true,
  runLai: true,
}

interface Props {
  runId: string | null
  eyebrow: string
  title: string
  /** Steps shown before any run starts (from the current form). */
  idleContext: TimelineContext
  headerExtra?: ReactNode
}

export function RunWorkspace({ runId, eyebrow, title, idleContext, headerExtra }: Props) {
  const service = usePipelineService()
  const { summary, lines } = useRunStream(runId)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const running = summary?.status === 'running'
  const now = useNow(running)

  const ctx = summary ? (summary.options ?? UNKNOWN_CTX) : idleContext
  const detection = detectSteps(ctx, lines, summary?.status ?? 'idle')
  const counted = detection.steps.filter((s) => s.state !== 'skipped')
  const done = counted.filter((s) => s.state === 'done').length

  const view = summary ? statusView(summary) : null
  const elapsed = summary ? durationBetween(summary.startedAt, summary.finishedAt, now) : null

  const stats: StatItem[] = [
    {
      key: 'status',
      label: 'Status',
      value: !summary
        ? 'Idle'
        : summary.queuePosition
          ? `Queued #${summary.queuePosition}`
          : summary.status === 'running'
            ? 'Running'
            : summary.status === 'failed'
              ? 'Failed'
              : view?.tone === 'warn'
                ? 'Check log'
                : 'Completed',
      tone: view?.tone,
      title: view?.note ?? view?.label,
    },
    {
      key: 'step',
      label: 'Current step',
      value: detection.current?.def.title ?? '—',
    },
    {
      key: 'progress',
      label: 'Progress',
      value: summary && detection.anyMatch ? `${done}/${counted.length} steps` : '—',
      numeric: true,
    },
    {
      key: 'elapsed',
      label: 'Elapsed time',
      value: elapsed === null ? '00:00' : formatDuration(elapsed),
      numeric: true,
    },
  ]

  const cancel = async () => {
    if (!runId) return
    setCancelError(null)
    try {
      await service.cancelRun(runId)
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : String(e))
    }
  }

  const stateText = !summary
    ? 'waiting to start'
    : running
      ? `started ${formatDateTime(summary.startedAt)}`
      : `finished ${formatDateTime(summary.finishedAt)}`

  return (
    <div className={styles.workspace}>
      <div className={styles.title}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2>{title}</h2>
          {summary?.path && <FolderPath path={summary.path} />}
        </div>
        <div className={styles.meta}>
          <span>
            run id <b>{runId ?? '—'}</b>
          </span>
          <span>{stateText}</span>
          {running && !summary?.readOnly && (
            <button type="button" className={styles.cancel} onClick={cancel}>
              <Square size={11} aria-hidden="true" /> Cancel run
            </button>
          )}
          {cancelError && (
            <span role="alert" className={styles.error}>
              {cancelError}
            </span>
          )}
          {headerExtra}
        </div>
      </div>

      <div className={styles.stats}>
        {view?.note && (
          <p className={styles.warning} role="status">
            {view.note}
          </p>
        )}
        <StatCards items={stats} />
      </div>

      <section className={`${styles.card} ${styles.timeline}`} aria-label="Execution timeline">
        <div className={styles.cardHead}>
          <span className={`${styles.pulse} ${running ? styles.on : ''}`} aria-hidden="true" />
          <h3>Execution timeline</h3>
          <span className={styles.cardMeta}>{counted.length} steps</span>
        </div>
        <div className={styles.cardBody}>
          {summary && !detection.anyMatch && (
            <p className={styles.note}>
              {running
                ? 'No step message detected yet. Follow the execution log.'
                : 'No step message was found in this log. See the execution log.'}
            </p>
          )}
          <Timeline steps={detection.steps} />
        </div>
      </section>

      <section className={`${styles.card} ${styles.console}`} aria-label="Execution log">
        <div className={`${styles.cardHead} ${styles.consoleHead}`}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h3>Execution log</h3>
          <span className={styles.cardMeta}>log.txt</span>
        </div>
        <LogConsole
          lines={lines}
          live={running || !summary}
          empty={runId ? 'Loading log…' : 'Waiting for form submission to start'}
        />
      </section>
    </div>
  )
}
