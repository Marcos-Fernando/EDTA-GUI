/**
 * "Repeat Classes" block of the EDTA annotation summary (*.mod.EDTA.TEanno.sum, written by
 * EDTA's buildSummary.pl) as the same tree as the RepeatMasker TE table, so the panEDTA runs
 * (and EDTA runs without REPORT/) get the same table and donut chart.
 *
 *   Total Length: 1000000 bp
 *   LTR                    --           --           --
 *       Copia              5            13719        1.37%
 *   low_complexity         1            355          0.04%
 *   Total                  92           147519       14.75%
 *
 * A class line with "--" gets the sums of its subclasses.
 */
import type { TENode, TEReportMeta } from './teReport'

const ROW_RE = /^(\s*)(\S.*?)\s+(--|\d+)\s+(--|\d+)\s+(--|[\d.]+%)\s*$/

const num = (s: string) => (s === '--' ? null : Number(s.replace('%', '')))

export function parseEdtaSum(
  raw: string,
  fileName: string | null = null,
): { meta: TEReportMeta; tree: TENode[] } | null {
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, ''))
  const start = lines.findIndex((l) => /^Repeat Classes/.test(l.trim()))
  if (start < 0) return null
  const stop = lines.findIndex((l, i) => i > start && /^Repeat Stats/.test(l.trim()))
  const block = lines.slice(start, stop < 0 ? undefined : stop)

  const meta: TEReportMeta = {
    fileName,
    sequences: null,
    totalLength: null,
    basesMasked: null,
    totalLengthBp: null,
    basesMaskedBp: null,
  }
  const tree: TENode[] = []
  let parent: TENode | null = null

  for (const line of block) {
    const trimmed = line.trim()
    const seq = /^Total Sequences:\s*(\d+)/.exec(trimmed)
    if (seq) meta.sequences = seq[1]
    const len = /^Total Length:\s*(\d+)\s*bp/.exec(trimmed)
    if (len) {
      meta.totalLengthBp = Number(len[1])
      meta.totalLength = `${len[1]} bp`
    }

    const m = ROW_RE.exec(line)
    if (!m || /^(Class|=+)$/.test(m[2])) continue
    const [, indent, name, elements, bp, pct] = m
    if (name === 'Total') {
      meta.basesMaskedBp = num(bp)
      meta.basesMasked = `${bp} bp ( ${pct.replace('%', ' %')})`
      continue
    }
    if (/^total interspersed$/i.test(name)) continue

    const node: TENode = {
      name,
      elements: num(elements),
      lengthBp: num(bp),
      percentage: num(pct),
      children: [],
    }
    if (indent.length > 0 && parent) {
      parent.children.push(node)
    } else {
      tree.push(node)
      parent = node
    }
  }

  // classes printed with "--": sums of their subclasses
  for (const node of tree) {
    if (node.lengthBp !== null || !node.children.length) continue
    const sum = (key: 'elements' | 'lengthBp') =>
      node.children.reduce((acc, c) => acc + (c[key] ?? 0), 0)
    node.elements = sum('elements')
    node.lengthBp = sum('lengthBp')
    node.percentage = meta.totalLengthBp ? (node.lengthBp / meta.totalLengthBp) * 100 : null
  }
  return { meta, tree }
}
