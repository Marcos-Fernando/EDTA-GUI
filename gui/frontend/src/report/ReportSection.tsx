import type { ReactNode } from 'react'
import { SegmentedControl } from '../components/SegmentedControl'
import type { ReportSectionDef } from '../config/reportSections'
import styles from './Report.module.scss'

export type SectionMode = 'interactive' | 'images'

interface Props {
  def: ReportSectionDef
  /** Shows the Interactive / Images switch when both views exist. */
  mode?: { value: SectionMode; onChange: (m: SectionMode) => void }
  /** Why the interactive view is not offered (large data). */
  note?: string | null
  actions?: ReactNode
  children: ReactNode
}

export function ReportSection({ def, mode, note, actions, children }: Props) {
  const headingId = `report-${def.id}`
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <header className={styles.sectionHead}>
        <div>
          <h3 id={headingId}>{def.title}</h3>
          <p className={styles.muted}>{def.subtitle}</p>
        </div>
        <div className={styles.sectionTools}>
          {actions}
          {mode && (
            <SegmentedControl
              label={`${def.title}: view`}
              value={mode.value}
              onChange={mode.onChange}
              options={[
                { value: 'interactive', label: 'Interactive' },
                { value: 'images', label: 'Images' },
              ]}
            />
          )}
        </div>
      </header>
      {note && <p className={styles.sectionNote}>{note}</p>}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}
