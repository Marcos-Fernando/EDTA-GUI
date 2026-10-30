import {
  buildHistogram,
  estimateDensity,
  findPeaks,
  mean,
  median,
  stdDev,
} from '../parse/insertionTime'
import { KatuChart } from './KatuChart'
import styles from '../Report.module.scss'

interface Props {
  ages: number[]
  title: string
  color: string
}

export function InsertionTimeChart({ ages, title, color }: Props) {
  if (ages.length === 0) return <p className={styles.muted}>No insertion age in this file.</p>

  const avg = mean(ages)
  const med = median(ages)
  const sd = stdDev(ages, avg)
  const density = estimateDensity(ages)

  const options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: title },
    legend: { enabled: false },
    xAxis: {
      title: { text: 'Mya' },
      min: 0,
      plotLines: [
        { value: avg, color: '#333', width: 1.5, dashStyle: 'Solid', zIndex: 5 },
        { value: med, color: '#333', width: 1.5, dashStyle: 'Dash', zIndex: 5 },
      ],
    },
    yAxis: { title: { text: 'Density' }, min: 0 },
    tooltip: { pointFormat: '{point.x:.2f} Mya<br/>Density: {point.y:.3f}' },
    series: [
      {
        name: 'Histogram',
        type: 'column',
        color,
        pointPadding: 0,
        groupPadding: 0,
        borderWidth: 0.5,
        borderColor: '#fff',
        data: buildHistogram(ages).map((b) => ({ x: b.x, y: b.density })),
      },
      {
        name: 'Density',
        type: 'area',
        color: '#000',
        fillColor: `${color}55`,
        dashStyle: 'Dash',
        lineWidth: 1.5,
        marker: { enabled: false },
        data: density,
      },
      {
        name: 'Peaks',
        type: 'scatter',
        color: '#000',
        marker: { radius: 4, symbol: 'circle' },
        dataLabels: { enabled: true, format: '{point.custom.label}', y: -12 },
        data: findPeaks(density).map((p) => ({ ...p, custom: { label: `${p.x.toFixed(1)} Mya` } })),
      },
    ],
  }

  return (
    <figure className={styles.figure}>
      <KatuChart options={options} height={340} />
      <figcaption className={styles.stats}>
        <span>n = {ages.length}</span>
        <span>mean {avg.toFixed(2)} Mya</span>
        <span>median {med.toFixed(2)} Mya</span>
        <span>SD {sd.toFixed(2)}</span>
      </figcaption>
    </figure>
  )
}
