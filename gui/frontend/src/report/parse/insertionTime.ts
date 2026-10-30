/**
 * LTR insertion ages (REPORT/AGE-Copia.txt, AGE-Gypsy.txt: "<id>\t<age in years>").
 * Adapted from AnnoTEPDB_v2 (components/histogram/insertionTime.ts).
 */

/** Math.max(...big array) overflows the call stack; a loop does not. */
function safeMax(values: number[]): number {
  let max = -Infinity
  for (const v of values) if (v > max) max = v
  return max
}

/** Ages in Mya. */
export function parseInsertionAges(raw: string): number[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseFloat(l.split(/\s+/)[1]) / 1e6)
    .filter((age) => !Number.isNaN(age))
}

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

export function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function stdDev(v: number[], avg: number): number {
  if (v.length < 2) return 0
  return Math.sqrt(v.reduce((sum, x) => sum + (x - avg) ** 2, 0) / (v.length - 1))
}

/** Histogram in density units, binwidth 0.1 Mya (same as the R script). */
export function buildHistogram(values: number[], binwidth = 0.1): { x: number; density: number }[] {
  const counts = new Array<number>(Math.ceil(safeMax(values) / binwidth) + 1).fill(0)
  for (const v of values) counts[Math.floor(v / binwidth)] += 1
  return counts.map((c, i) => ({
    x: i * binwidth + binwidth / 2,
    density: c / (values.length * binwidth),
  }))
}

/** Gaussian KDE with Silverman's bandwidth (close to R's bw = "nrd0"). */
export function estimateDensity(values: number[], gridPoints = 200): { x: number; y: number }[] {
  const avg = mean(values)
  const sd = stdDev(values, avg)
  const sorted = [...values].sort((a, b) => a - b)
  const iqr = sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)]
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd
  const bw = 0.9 * spread * Math.pow(values.length, -0.2) || 0.1
  const step = safeMax(values) / gridPoints

  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= gridPoints; i++) {
    const x = i * step
    let sum = 0
    for (const v of values) {
      const u = (x - v) / bw
      sum += Math.exp(-0.5 * u * u)
    }
    points.push({ x, y: sum / (values.length * bw * Math.sqrt(2 * Math.PI)) })
  }
  return points
}

/** Local maxima above 10% of the highest one (diff(sign(diff(y))) == -2 in R). */
export function findPeaks(density: { x: number; y: number }[]): { x: number; y: number }[] {
  const maxY = safeMax(density.map((p) => p.y))
  return density.filter(
    (p, i) =>
      i > 0 &&
      i < density.length - 1 &&
      p.y > density[i - 1].y &&
      p.y > density[i + 1].y &&
      p.y > maxY * 0.1,
  )
}
