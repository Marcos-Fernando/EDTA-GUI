import styles from './StatCards.module.scss'

export interface StatItem {
  key: string
  label: string
  value: string
  tone?: 'running' | 'ok' | 'error' | 'warn'
  numeric?: boolean
  title?: string
}

/** Row of real run statistics. No fictitious values. */
export function StatCards({ items }: { items: StatItem[] }) {
  return (
    <dl className={styles.stats}>
      {items.map((it) => (
        <div key={it.key} className={styles.stat}>
          <dt className={styles.k}>{it.label}</dt>
          <dd
            className={`${styles.v} ${it.numeric ? styles.num : ''} ${it.tone ? styles[it.tone] : ''}`}
            title={it.title ?? it.value}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
