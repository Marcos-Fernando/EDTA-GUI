/**
 * RepeatMasker TE table (REPORT/*-LITE.tbl, *-COMPLETE.tbl) as a tree.
 * Adapted from AnnoTEPDB_v2 (src/pages/genomes/components/tereports/parseTEReport.ts).
 */

export interface TENode {
  name: string
  elements: number | null
  lengthBp: number | null
  percentage: number | null
  children: TENode[]
}

export interface TEReportMeta {
  fileName: string | null
  sequences: string | null
  totalLength: string | null
  basesMasked: string | null
  /** Total length in bp, parsed from "total length: 30427671 bp (…)". */
  totalLengthBp: number | null
  /** Masked bases in bp, parsed from "bases masked: 21440922 bp ( 17.92 %)". */
  basesMaskedBp: number | null
}

/** Category clicked in the TE table; `key` is its path, since names repeat across levels. */
export interface TESelection {
  key: string
  name: string
  lengthBp: number
}

const NODE_RE = /^([|\s]*-*)\s*([^\t]+?):?\s*(?:(\d+)\s+(\d+)\s*bp\s+([\d.]+)\s*%)?\s*$/

export function parseTEReport(raw: string): { meta: TEReportMeta; tree: TENode[] } {
  const lines = raw.split('\n')
  const meta: TEReportMeta = {
    fileName: null,
    sequences: null,
    totalLength: null,
    basesMasked: null,
    totalLengthBp: null,
    basesMaskedBp: null,
  }

  // "=====" lines delimit the header (meta) and the body (tree)
  const equals: number[] = []
  lines.forEach((line, i) => {
    if (/^=+$/.test(line.trim())) equals.push(i)
  })

  const value = (line: string) => line.slice(line.indexOf(':') + 1).trim() || null
  if (equals.length >= 2) {
    for (let i = equals[0] + 1; i < equals[1]; i++) {
      const line = lines[i]
      if (/file name:/i.test(line)) meta.fileName = value(line)
      if (/^sequences:/i.test(line.trim())) meta.sequences = value(line)
      if (/total length:/i.test(line)) meta.totalLength = value(line)
      if (/bases masked:/i.test(line)) meta.basesMasked = value(line)
    }
  }
  const bp = meta.totalLength ? /^(\d+)\s*bp/.exec(meta.totalLength) : null
  meta.totalLengthBp = bp ? Number(bp[1]) : null
  const masked = meta.basesMasked ? /^(\d+)\s*bp/.exec(meta.basesMasked) : null
  meta.basesMaskedBp = masked ? Number(masked[1]) : null

  const start = equals.length >= 2 ? equals[1] + 1 : 0
  const end = equals.length >= 3 ? equals[2] : lines.length

  const root: TENode = {
    name: 'root',
    elements: null,
    lengthBp: null,
    percentage: null,
    children: [],
  }
  const stack: { node: TENode; indent: number }[] = [{ node: root, indent: -1 }]

  for (const rawLine of lines.slice(start, end)) {
    const line = rawLine.replace(/\r$/, '')
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      /^[-=\s]+$/.test(trimmed) || // rule
      /^[|\s]+$/.test(trimmed) || // only vertical connectors
      /^-{2,}.*-{2,}$/.test(trimmed) || // banner "----Class I:Results----"
      /number of/i.test(trimmed) || // column headers
      /elements\*/i.test(trimmed)
    )
      continue

    const m = NODE_RE.exec(line)
    if (!m) continue
    const [, prefix, rawName, elements, lengthBp, percentage] = m
    const name = rawName.trim()
    if (!name) continue

    const node: TENode = {
      name,
      elements: elements ? parseInt(elements, 10) : null,
      lengthBp: lengthBp ? parseInt(lengthBp, 10) : null,
      percentage: percentage ? parseFloat(percentage) : null,
      children: [],
    }

    // The global "Unclassified" (short "-" prefix) is a root; the ones inside
    // LTR/Copia and LTR/Gypsy have "|" in the prefix and stay nested.
    const forcedRoot = /^unclassified$/i.test(name) && /^-+$/.test(prefix) && prefix.length <= 2
    const indent = forcedRoot ? 0 : prefix.length

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    stack.push({ node, indent })
  }

  return { meta, tree: root.children }
}

function findByName(nodes: TENode[], target: string): TENode | null {
  for (const node of nodes) {
    if (node.name.toLowerCase() === target.toLowerCase() && node.elements !== null) return node
    const found = findByName(node.children, target)
    if (found) return found
  }
  return null
}

/** Fixed EDTA/RepeatMasker classes (names are the same for every genome). */
const GENERAL_CATEGORIES = [
  'Non-LTR',
  'LTR Non-auto',
  'LTR/Copia',
  'LTR/Gypsy',
  'TIRs',
  'Unclassified',
]

export function getGeneralCategories(tree: TENode[]): TENode[] {
  const found: TENode[] = []
  for (const name of GENERAL_CATEGORIES) {
    // "Unclassified" also exists inside Copia/Gypsy: the global one is a root
    const node =
      name === 'Unclassified'
        ? (tree.find((n) => n.name.toLowerCase() === 'unclassified' && n.elements !== null) ?? null)
        : findByName(tree, name)
    if (node && node.elements !== null && node.elements > 0) found.push(node)
  }
  return found
}

/** Generic names that, when nested (e.g. inside LTR/Copia or TIRs), stay out of the leaves. */
const NESTED_GENERIC_NAMES = ['unclassified', 'unknown']

/**
 * Leaf categories with at least one element (whatever the genome has). Nested
 * "Unclassified"/"Unknown" are left out, as in the TE-Report2 bar plot of the pipeline:
 * only the global category is kept.
 */
export function getLeafCategories(tree: TENode[]): TENode[] {
  const leaves: TENode[] = []
  const walk = (nodes: TENode[], depth: number) => {
    for (const node of nodes) {
      if (node.children.length) {
        walk(node.children, depth + 1)
        continue
      }
      const nestedGeneric = depth > 0 && NESTED_GENERIC_NAMES.includes(node.name.toLowerCase())
      if (!nestedGeneric && node.elements !== null && node.elements > 0) leaves.push(node)
    }
  }
  walk(tree, 0)
  return leaves
}

/** Short names used in the charts of the pipeline (TE-Report2-bar.png). */
const SHORT_LABELS: Record<string, string> = {
  'BARE-2': 'BARE2',
  EnSpm_CACTA: 'CACTA',
  'MuDR_Mutator/MULE': 'MuDR/MULE',
  PIF_Harbinger: 'Harbinger',
  'RC/Helitron': 'Helitron',
}

export function getChartLabel(name: string): string {
  return SHORT_LABELS[name] ?? name
}
