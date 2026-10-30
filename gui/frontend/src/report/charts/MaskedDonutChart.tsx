import type { TEReportMeta, TESelection } from '../parse/teReport'
import { KatuChart } from './KatuChart'
import styles from '../Report.module.scss'

const REST = '#d1d5db'

/** Mode accent (wine for EDTA, green for AnnoTEP), read from the page tokens. */
function accent(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--mode-accent').trim()
  return v || '#7a1f2b'
}

/**
 * Donut of the genome fraction masked by repeats, from the header of the RepeatMasker table
 * ("total length" and "bases masked"). With a category selected in the table, it shows that
 * category against the rest of the genome. Adapted from AnnoTEPDB_v2 (MaskedDonutChart).
 */
export function MaskedDonutChart({
  meta,
  selection,
  onReset,
}: {
  meta: TEReportMeta
  selection: TESelection | null
  onReset: () => void
}) {
  const totalBp = meta.totalLengthBp
  const maskedBp = meta.basesMaskedBp
  if (!totalBp || maskedBp === null || maskedBp > totalBp) {
    return <p className={styles.muted}>Genome coverage data unavailable.</p>
  }

  const selected = selection && selection.lengthBp <= totalBp ? selection : null
  const pct = (bp: number) => ((bp / totalBp) * 100).toFixed(2)
  const mb = (bp: number) => (bp / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 2 })
  const slice = (name: string, bp: number, color: string) => ({
    name,
    y: bp,
    color,
    custom: { mb: mb(bp), pct: pct(bp) },
  })
  const main = accent()

  const options = {
    chart: { type: 'pie', backgroundColor: 'transparent' },
    title: { text: selected ? selected.name : 'Genome masked by repeats' },
    subtitle: { text: `Genome size: ${mb(totalBp)} Mb` },
    legend: { enabled: true, align: 'center', verticalAlign: 'bottom' },
    tooltip: { pointFormat: '{point.custom.mb} Mb<br/>{point.custom.pct}% of the genome' },
    series: [
      {
        type: 'pie',
        name: 'Genome',
        innerSize: '60%',
        dataLabels: {
          enabled: true,
          format: '{point.custom.pct}%',
          style: { fontSize: '16px', fontWeight: 'bold' },
        },
        data: selected
          ? [
              slice(selected.name, selected.lengthBp, main),
              slice('Rest of the genome', totalBp - selected.lengthBp, REST),
            ]
          : [
              slice('Masked (TEs and repeats)', maskedBp, main),
              slice('Unmasked', totalBp - maskedBp, REST),
            ],
      },
    ],
  }

  return (
    <div className={styles.donut}>
      {/* key: a new chart per selection (entry animation, nothing left from the previous one) */}
      <KatuChart key={selected?.key ?? 'masked'} options={options} height={380} />
      <div className={styles.donutFoot} aria-live="polite">
        {selected ? (
          <button type="button" className={styles.donutReset} onClick={onReset}>
            Show total masked
          </button>
        ) : (
          <p className={styles.muted}>Click a row of the table to see its share of the genome.</p>
        )}
      </div>
    </div>
  )
}
