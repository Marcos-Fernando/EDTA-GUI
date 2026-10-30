import { useId, type ReactNode } from 'react'
import type { HelpKey } from '../content/help'
import { HelpPopover } from './HelpPopover'
import styles from './FormSection.module.scss'

interface Props {
  num: string
  title: string
  hint?: string
  help?: HelpKey
  children: ReactNode
}

/** Numbered sidebar section. */
export function FormSection({ num, title, hint, help, children }: Props) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.head}>
        <span className={styles.num} aria-hidden="true">
          {num}
        </span>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        <span className={styles.end}>
          {hint && <span className={styles.hint}>{hint}</span>}
          {help && <HelpPopover topic={help} />}
        </span>
      </div>
      {children}
    </section>
  )
}
