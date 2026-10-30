import { normalizeDivsum, stackedAxisMax, type DivsumTable } from '../parse/divsum'
import { KatuChart } from './KatuChart'

/** Close to viridis (option "D") used by the R script. */
const VIRIDIS = [
  '#440154',
  '#472d7b',
  '#3b528b',
  '#2c728e',
  '#21908c',
  '#27ad81',
  '#5dc863',
  '#aadc32',
  '#fde725',
]

export function RepeatLandscapeChart({
  table,
  genomeBp,
}: {
  table: DivsumTable
  genomeBp: number
}) {
  const series = normalizeDivsum(table, genomeBp)
  const yMax = stackedAxisMax(series)
  let maxDiv = 0
  for (const r of table.rows) if (r.div > maxDiv) maxDiv = r.div

  const options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Repeat landscape' },
    xAxis: {
      title: { text: 'Kimura substitution level' },
      // Columns are centred on each level: half a level on each side keeps the first
      // column (Kimura 0) off the Y axis line. Explicit ticks, or the axis starts at "-1".
      min: -0.5,
      max: maxDiv + 0.5,
      tickPositions: Array.from({ length: Math.floor(maxDiv / 5) + 1 }, (_, i) => i * 5),
    },
    yAxis: {
      title: { text: 'Percent of the genome' },
      min: 0,
      // The sum of the stacked classes, not the largest single class.
      max: yMax,
      gridLineWidth: 0.5,
    },
    legend: { align: 'right', verticalAlign: 'top', layout: 'vertical' },
    plotOptions: {
      column: {
        stacking: 'normal',
        borderWidth: 0.5,
        borderColor: '#000',
        groupPadding: 0,
        pointPadding: 0,
      },
    },
    tooltip: {
      shared: true,
      valueDecimals: 4,
      valueSuffix: '%',
      headerFormat: '<span style="font-size: 10px">Kimura {point.key}</span><br/>',
    },
    series: series
      .map((s, i) => ({
        name: s.className,
        color: VIRIDIS[i % VIRIDIS.length],
        // {x, y} objects: the library's stacked range ignores [x, y] pairs
        data: s.data.map(([x, y]) => ({ x, y })),
      }))
      .reverse()
      .concat([
        // The library ignores yAxis.max for stacked columns and scales the axis by the
        // largest single value: an invisible point at the top keeps the columns inside.
        {
          name: '_ceiling',
          type: 'scatter',
          data: [{ x: 0, y: yMax }],
          marker: { enabled: false },
          opacity: 0,
          enableMouseTracking: false,
          showInLegend: false,
        } as never,
      ]),
  }
  return <KatuChart options={options} height={480} />
}
