import { useState } from 'react'
import { SegmentedControl } from '../../components/SegmentedControl'
import { getGeneralCategories, getLeafCategories, type TENode } from '../parse/teReport'
import { KatuChart } from './KatuChart'
import styles from '../Report.module.scss'

/** Blue → light grey → red by value (matplotlib "coolwarm", as in the static plots). */
function coolwarm(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (value - min) / (max - min)
  const [from, to, local] =
    t <= 0.5
      ? [[59, 76, 192], [221, 221, 221], t / 0.5]
      : [[221, 221, 221], [180, 4, 38], (t - 0.5) / 0.5]
  const rgb = (from as number[]).map((c, i) =>
    Math.round(c + ((to as number[])[i] - c) * (local as number)),
  )
  return `rgb(${rgb.join(', ')})`
}

function chartOptions(nodes: TENode[], title: string) {
  // keep the table order (better to compare genomes than sorting by size)
  const mb = nodes.map((n) => (n.lengthBp ?? 0) / 1e6)
  const els = nodes.map((n) => n.elements ?? 0)
  const pct = nodes.map((n) => n.percentage ?? 0)
  const [minEl, maxEl] = [Math.min(...els), Math.max(...els)]
  const [minPct, maxPct] = [Math.min(...pct), Math.max(...pct)]

  const bar = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: title },
    legend: { enabled: false },
    xAxis: {
      categories: nodes.map((n) => n.name),
      title: { text: 'TE type' },
      labels: { rotation: -35 },
    },
    yAxis: { title: { text: 'Length occupied (Mb)' }, min: 0 },
    tooltip: {
      pointFormat:
        'Length: {point.y:.2f} Mb<br/>Occurrences: {point.custom.elements}<br/>Percentage: {point.custom.pct}%',
    },
    series: [
      {
        name: 'Length (Mb)',
        dataLabels: { enabled: true, format: '{point.custom.elements}' },
        data: nodes.map((n, i) => ({
          y: mb[i],
          name: n.name,
          color: coolwarm(els[i], minEl, maxEl),
          custom: { elements: els[i], pct: pct[i].toFixed(2) },
        })),
      },
    ],
  }

  const bubble = {
    chart: { type: 'bubble', backgroundColor: 'transparent' },
    title: { text: title },
    legend: { enabled: false },
    xAxis: { title: { text: 'Occurrences' }, min: 0 },
    yAxis: { title: { text: 'Length occupied (Mb)' }, min: 0 },
    tooltip: {
      pointFormat: 'Occurrences: {point.x}<br/>Length: {point.y:.2f} Mb<br/>Percentage: {point.z}%',
    },
    series: [
      {
        name: 'TE categories',
        dataLabels: { enabled: true, format: '{point.name}' },
        data: nodes.map((n, i) => ({
          x: els[i],
          y: mb[i],
          z: pct[i],
          name: n.name,
          color: coolwarm(pct[i], minPct, maxPct),
        })),
      },
    ],
  }
  return { bar, bubble }
}

type View = 'general' | 'detailed'

export function TECharts({ tree }: { tree: TENode[] }) {
  const [view, setView] = useState<View>('general')
  const nodes = view === 'general' ? getGeneralCategories(tree) : getLeafCategories(tree)
  const { bar, bubble } = chartOptions(nodes, view === 'general' ? 'TE classes' : 'TE lineages')

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <SegmentedControl
          label="Category level"
          value={view}
          onChange={setView}
          options={[
            { value: 'general', label: 'General' },
            { value: 'detailed', label: 'Detailed' },
          ]}
        />
      </div>
      {nodes.length === 0 ? (
        <p className={styles.muted}>No TE category with elements in this table.</p>
      ) : (
        <div className={styles.twoCols}>
          <KatuChart options={bar} height={420} />
          <KatuChart options={bubble} height={420} />
        </div>
      )}
    </div>
  )
}
