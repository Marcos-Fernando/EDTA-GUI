import { CheckCircle2, Clock, PlayCircle, X, XCircle } from 'lucide-react'
import { hrefFor } from '../hooks/useHashRoute'
import { useNotify } from './NotifyContext'
import type { NoticeKind } from './notices'
import styles from './Notices.module.scss'

const ICONS: Record<NoticeKind, typeof CheckCircle2> = {
  started: PlayCircle,
  queued: Clock,
  finished: CheckCircle2,
  failed: XCircle,
}

/** Large messages that stay until closed, so nobody misses the start or end of a run. */
export function NoticeStack() {
  const { notices, dismiss } = useNotify()
  if (notices.length === 0) return null

  return (
    <div className={styles.stack} aria-label="Notifications" role="region">
      {notices.map((n) => {
        const Icon = ICONS[n.kind]
        const ended = n.kind === 'finished' || n.kind === 'failed'
        return (
          <section
            key={n.id}
            className={`${styles.notice} ${styles[n.kind]}`}
            role={n.kind === 'failed' ? 'alert' : 'status'}
            aria-labelledby={`${n.id}-title`}
          >
            <Icon className={styles.icon} size={40} strokeWidth={2.2} aria-hidden="true" />
            <div className={styles.body}>
              <h2 id={`${n.id}-title`} className={styles.title}>
                {n.title}
              </h2>
              <p className={styles.message}>{n.message}</p>
              <div className={styles.actions}>
                {ended && (
                  <a
                    className={styles.primary}
                    href={hrefFor({ page: 'run', runId: n.runId })}
                    onClick={() => dismiss(n.id)}
                  >
                    Open results
                  </a>
                )}
                <button type="button" className={styles.close} onClick={() => dismiss(n.id)}>
                  <X size={20} aria-hidden="true" />
                  {ended ? 'Close' : 'OK, close'}
                </button>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
