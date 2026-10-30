import { useEffect, useRef, type ReactNode } from 'react'
import { lineTone } from '../utils/logTone'
import styles from './LogConsole.module.scss'

interface Props {
  lines: readonly string[]
  /** Shown when there are no lines. */
  empty?: ReactNode
  /** Blinking cursor at the end while the run is active. */
  live?: boolean
  /** Keep the view scrolled to the newest line. */
  follow?: boolean
  className?: string
  label?: string
}

/** Dark log console. */
export function LogConsole({
  lines,
  empty = 'No log lines.',
  live,
  follow = true,
  className,
  label = 'Execution log',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (follow && el) el.scrollTop = el.scrollHeight
  }, [lines, follow])

  return (
    <div
      ref={ref}
      className={`${styles.console} ${className ?? ''}`}
      role="log"
      aria-label={label}
      aria-live={live ? 'polite' : 'off'}
      tabIndex={0}
    >
      {lines.length === 0 ? (
        <div className={styles.line}>
          <span className={styles.gutter}>--</span>
          <span>
            {empty}
            {live && <span className={styles.cursor} aria-hidden="true" />}
          </span>
        </div>
      ) : (
        lines.map((text, i) => {
          const tone = lineTone(text)
          return (
            <div key={i} className={`${styles.line} ${tone ? styles[tone] : ''}`}>
              <span className={styles.gutter} aria-hidden="true">
                {i + 1}
              </span>
              <span>
                {text || ' '}
                {live && i === lines.length - 1 && (
                  <span className={styles.cursor} aria-hidden="true" />
                )}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
