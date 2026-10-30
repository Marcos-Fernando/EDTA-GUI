import { useState } from 'react'
import { SegmentedControl } from '../../components/SegmentedControl'
import {
  getChartLabel,
  getGeneralCategories,
  getLeafCategories,
  type TENode,
} from '../parse/teReport'
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

/** The small part of the chart library (a d3 selection) used to draw inside the SVG. */
interface Sel {
  select(query: string): Sel
  selectAll(query: string): Sel
  append(tag: string): Sel
  remove(): Sel
  attr(name: string): string
  attr(name: string, value: string | number): Sel
  style(name: string, value: string): Sel
  text(value: string): Sel
}

interface RenderContext {
  plotLeft: number
  plotTop: number
  plotHeight: number
  renderer: {
    svg: Sel
    defs: Sel
    createLinearGradient(
      id: string,
      x1: string,
      y1: string,
      x2: string,
      y2: string,
      stops: { offset: string; color: string }[],
    ): void
  }
}

/**
 * Colour legend (coolwarm bar with min and max), drawn inside the SVG on every render so it
 * is also in the PNG/SVG/PDF export. Same role as the colour bar of the static plots.
 */
function drawColorLegend(
  chart: RenderContext,
  gradientId: string,
  label: string,
  min: string,
  max: string,
) {
  const svg = chart.renderer.svg
  svg.selectAll('.te-color-legend').remove()
  chart.renderer.defs.select(`#${gradientId}`).remove()
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    offset: `${t * 100}%`,
    color: coolwarm(t, 0, 1),
  }))
  // bottom → top: minimum (blue) below, maximum (red) above
  chart.renderer.createLinearGradient(gradientId, '0%', '100%', '0%', '0%', stops)

  const barH = 64
  const g = svg
    .append('g')
    .attr('class', 'te-color-legend')
    .attr('transform', `translate(${chart.plotLeft + 12}, ${chart.plotTop + 10})`)
    .style('pointer-events', 'none')
  g.append('rect')
    .attr('x', -6)
    .attr('y', -6)
    .attr('width', 96)
    .attr('height', barH + 30)
    .attr('rx', 4)
    .attr('fill', '#ffffff')
    .attr('fill-opacity', 0.85)
  g.append('rect')
    .attr('width', 14)
    .attr('height', barH)
    .attr('fill', `url(#${gradientId})`)
    .attr('stroke', '#cccccc')
  const text = (value: string, x: number, y: number) =>
    g
      .append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('font-size', 11)
      .attr('fill', '#333333')
      .text(value)
  text(max, 20, 9)
  text(min, 20, barH)
  text(label, 0, barH + 16)
}

/**
 * Title of the right Y axis, drawn by hand: for `opposite` axes the library counts the chart
 * width twice and its own title falls outside the SVG.
 */
function drawRightAxisTitle(chart: RenderContext, title: string) {
  const svg = chart.renderer.svg
  svg.selectAll('.te-right-axis-title').remove()
  const x = Number(svg.attr('width')) - 14
  const y = chart.plotTop + chart.plotHeight / 2
  svg
    .append('text')
    .attr('class', 'te-right-axis-title')
    .attr('x', x)
    .attr('y', y)
    .attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90, ${x}, ${y})`)
    .attr('font-size', 12)
    .attr('fill', '#333333')
    .text(title)
}

/** Rounds up to 1, 1.5, 2, 2.5… × 10^n: the shared top of the Mb and % axes. */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(value))
  return (Math.ceil((value / step) * 2) / 2) * step
}

function chartOptions(nodes: TENode[], title: string, genomeBp: number | null) {
  // keep the table order (better to compare genomes than sorting by size)
  const names = nodes.map((n) => getChartLabel(n.name))
  const mb = nodes.map((n) => (n.lengthBp ?? 0) / 1e6)
  const els = nodes.map((n) => n.elements ?? 0)
  const pct = nodes.map((n) => n.percentage ?? 0)
  const [minEl, maxEl] = [Math.min(...els), Math.max(...els)]
  const [minPct, maxPct] = [Math.min(...pct), Math.max(...pct)]
  const yMaxMb = niceCeil(Math.max(...mb) * 1.05)
  const fmt = (n: number) => n.toLocaleString('en-GB')

  const bar = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      events: {
        render(this: RenderContext) {
          drawColorLegend(this, 'te-legend-bar', 'Occurrences', fmt(minEl), fmt(maxEl))
          if (genomeBp) drawRightAxisTitle(this, 'Percentage of genome occupied')
        },
      },
    },
    title: { text: title },
    legend: { enabled: false },
    xAxis: { categories: names, title: { text: 'TE type' }, labels: { rotation: -35 } },
    // Right axis: the same top as the left one, in % of the genome. The library has no
    // linked axes, so both get explicit min/max.
    yAxis: genomeBp
      ? [
          { title: { text: 'Length occupied (Mb)' }, min: 0, max: yMaxMb },
          {
            title: { text: null },
            opposite: true,
            min: 0,
            max: ((yMaxMb * 1e6) / genomeBp) * 100,
            gridLineWidth: 0,
            labels: {
              formatter(this: { value: number }) {
                return `${this.value.toFixed(1)}%`
              },
            },
          },
        ]
      : { title: { text: 'Length occupied (Mb)' }, min: 0 },
    tooltip: {
      pointFormat:
        'Length: {point.y:.2f} Mb<br/>Occurrences: {point.custom.elements}<br/>Percentage: {point.custom.pct}%',
    },
    series: [
      {
        name: 'Length (Mb)',
        dataLabels: { enabled: true, format: '{point.custom.elements}' },
        data: nodes.map((_, i) => ({
          y: mb[i],
          name: names[i],
          color: coolwarm(els[i], minEl, maxEl),
          custom: { elements: els[i], pct: pct[i].toFixed(2) },
        })),
      },
      // Invisible series on the right axis: without one, the library ignores its min/max.
      ...(genomeBp
        ? [
            {
              name: '_percentAxis',
              type: 'scatter',
              yAxis: 1,
              data: [{ x: 0, y: 0 }],
              marker: { enabled: false },
              opacity: 0,
              enableMouseTracking: false,
              showInLegend: false,
            },
          ]
        : []),
    ],
  }

  const bubble = {
    chart: {
      type: 'bubble',
      backgroundColor: 'transparent',
      events: {
        render(this: RenderContext) {
          drawColorLegend(
            this,
            'te-legend-bubble',
            '% of genome',
            `${minPct.toFixed(2)}%`,
            `${maxPct.toFixed(2)}%`,
          )
        },
      },
    },
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
        data: nodes.map((_, i) => ({
          x: els[i],
          y: mb[i],
          z: pct[i],
          name: names[i],
          color: coolwarm(pct[i], minPct, maxPct),
        })),
      },
    ],
  }
  return { bar, bubble }
}

type View = 'general' | 'detailed'

export function TECharts({ tree, genomeBp }: { tree: TENode[]; genomeBp: number | null }) {
  const [view, setView] = useState<View>('general')
  const nodes = view === 'general' ? getGeneralCategories(tree) : getLeafCategories(tree)
  const { bar, bubble } = chartOptions(
    nodes,
    view === 'general' ? 'TE classes' : 'TE lineages',
    genomeBp,
  )

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
          {/* key: a new chart per view. Updated in place, the library also applies the "%"
              formatter of the right axis to the left one. */}
          <KatuChart key={`bar-${view}`} options={bar} height={420} />
          <KatuChart key={`bubble-${view}`} options={bubble} height={420} />
        </div>
      )}
    </div>
  )
}
