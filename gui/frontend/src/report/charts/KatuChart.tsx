import KatuCharts from 'katucharts.js'
import { KatuChartsReact } from 'katucharts.js/react'
import styles from '../Report.module.scss'

// PDF export: the published katucharts build replaced its import('jspdf') with an empty
// stub, but it looks for a jsPDF global before falling back to a CDN. Expose the npm
// package (own chunk, fetched in background when the report opens) so export works offline.
void import('jspdf')
  .then(({ jsPDF }) => {
    const g = globalThis as { jsPDF?: unknown }
    g.jsPDF ??= jsPDF
  })
  .catch(() => {})

/**
 * Chart on a light "paper" (the library draws dark text), in both themes.
 * Without `width` it fills the parent; with it, the paper keeps that size (the parent scrolls).
 */
export function KatuChart({
  options,
  height,
  width,
}: {
  options: object
  height: number
  width?: number
}) {
  return (
    <div className={width ? `${styles.paper} ${styles.paperFixed}` : styles.paper}>
      <KatuChartsReact
        katuCharts={KatuCharts}
        options={options}
        containerProps={{ style: width ? { height, width } : { height } }}
      />
    </div>
  )
}
