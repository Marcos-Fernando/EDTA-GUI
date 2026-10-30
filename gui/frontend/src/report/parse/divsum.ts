/**
 * RepeatMasker .divsum (REPORT/<genome>.divsum): final "Div <class>…" table.
 * Adapted from AnnoTEPDB_v2 (components/repeatlandscape/parseDivsum.ts).
 */

export interface DivsumTable {
  classes: string[]
  rows: { div: number; values: Record<string, number> }[]
}

export function parseDivsum(raw: string): DivsumTable | null {
  const lines = raw.split('\n').map((l) => l.trim())
  const header = lines.findIndex((l) => /^Div\s+/.test(l))
  if (header === -1) return null

  const classes = lines[header].split(/\s+/).slice(1)
  const rows: DivsumTable['rows'] = []
  for (const line of lines.slice(header + 1)) {
    if (line === '') break
    const parts = line.split(/\s+/)
    const div = parseFloat(parts[0])
    if (parts.length < 2 || Number.isNaN(div)) continue
    const values: Record<string, number> = {}
    classes.forEach((c, i) => {
      values[c] = parseFloat(parts[i + 1]) || 0
    })
    rows.push({ div, values })
  }
  return { classes, rows }
}

/** Percent of the genome per class and Kimura level (kd_melt$norm in the R script). */
export function normalizeDivsum(
  table: DivsumTable,
  genomeSizeBp: number,
): { className: string; data: [number, number][] }[] {
  return table.classes.map((className) => ({
    className,
    data: table.rows
      .map((r): [number, number] => [r.div, (r.values[className] / genomeSizeBp) * 100])
      .filter(([, pct]) => !Number.isNaN(pct) && pct >= 0 && pct <= 100),
  }))
}

/**
 * Top of the Y axis for the stacked columns: the tallest column (sum of all classes at one
 * Kimura level) plus a little room, rounded up to a round step. The chart library scales
 * the axis by the largest single value, which cuts the top of stacked columns.
 */
export function stackedAxisMax(series: { data: [number, number][] }[]): number {
  const totals = new Map<number, number>()
  for (const s of series)
    for (const [div, pct] of s.data) totals.set(div, (totals.get(div) ?? 0) + pct)
  let max = 0
  for (const t of totals.values()) if (t > max) max = t
  if (max <= 0) return 1
  const raw = max * 1.08
  const step = 10 ** Math.floor(Math.log10(raw)) / 5
  return Math.ceil(raw / step) * step
}
