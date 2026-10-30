/**
 * Newick parser (IQ-TREE output with bootstrap labels) and midpoint rooting.
 * Adapted from AnnoTEPDB_v2 (components/phylotree/newick.ts and midPointRoot.ts).
 */

export interface PhyloNode {
  id: string
  /** Tip name; empty for internal nodes. */
  name: string
  /** Branch length to the parent. */
  length: number
  /** Bootstrap of internal nodes (0–1 or 0–100 as written), null otherwise. */
  support: number | null
  children: PhyloNode[]
}

export function parseNewick(raw: string): PhyloNode {
  const str = raw.trim().replace(/;\s*$/, '')
  let pos = 0
  let ids = 0

  const token = () => {
    let out = ''
    while (pos < str.length && !',():;'.includes(str[pos])) out += str[pos++]
    return out
  }

  const node = (): PhyloNode => {
    const n: PhyloNode = { id: `n${++ids}`, name: '', length: 0, support: null, children: [] }
    if (str[pos] === '(') {
      pos++
      n.children.push(node())
      while (str[pos] === ',') {
        pos++
        n.children.push(node())
      }
      if (str[pos] === ')') pos++
      const label = token()
      if (label) {
        const v = parseFloat(label)
        n.support = Number.isNaN(v) ? null : v
      }
    } else {
      n.name = token()
    }
    if (str[pos] === ':') {
      pos++
      const len = parseFloat(token())
      n.length = Number.isNaN(len) ? 0 : len
    }
    return n
  }

  return node()
}

export function getLeaves(node: PhyloNode): PhyloNode[] {
  return node.children.length ? node.children.flatMap(getLeaves) : [node]
}

/** Counts tips without building the tree: a cheap size check before parsing. */
export function countLeaves(raw: string): number {
  let leaves = 0
  let expectingTip = true
  for (const ch of raw) {
    if (ch === '(' || ch === ',') expectingTip = true
    else if (ch === ')' || ch === ';') expectingTip = false
    else if (expectingTip && !/\s/.test(ch)) {
      leaves++
      expectingTip = false
    }
  }
  return leaves
}

/* ------------------------------ midpoint rooting ------------------------------ */

interface Edge {
  to: PhyloNode
  length: number
}

function allNodes(n: PhyloNode): PhyloNode[] {
  return [n, ...n.children.flatMap(allNodes)]
}

function adjacency(root: PhyloNode): Map<PhyloNode, Edge[]> {
  const adj = new Map<PhyloNode, Edge[]>()
  for (const n of allNodes(root)) adj.set(n, [])
  for (const n of allNodes(root)) {
    for (const c of n.children) {
      adj.get(n)!.push({ to: c, length: c.length })
      adj.get(c)!.push({ to: n, length: c.length })
    }
  }
  return adj
}

function farthest(start: PhyloNode, adj: Map<PhyloNode, Edge[]>) {
  const dist = new Map<PhyloNode, number>([[start, 0]])
  const prev = new Map<PhyloNode, PhyloNode | null>([[start, null]])
  const stack = [start]
  let far = start
  let max = 0
  while (stack.length) {
    const cur = stack.pop()!
    const d = dist.get(cur)!
    if (d > max) {
      max = d
      far = cur
    }
    for (const e of adj.get(cur) ?? []) {
      if (!dist.has(e.to)) {
        dist.set(e.to, d + e.length)
        prev.set(e.to, cur)
        stack.push(e.to)
      }
    }
  }
  const path: PhyloNode[] = []
  for (let cur: PhyloNode | null = far; cur; cur = prev.get(cur) ?? null) path.unshift(cur)
  return { node: far, dist: max, path }
}

function rebuild(start: PhyloNode, adj: Map<PhyloNode, Edge[]>): PhyloNode {
  const seen = new Set<PhyloNode>()
  const visit = (n: PhyloNode, length: number): PhyloNode => {
    seen.add(n)
    const copy: PhyloNode = { ...n, length, children: [] }
    for (const e of adj.get(n) ?? []) if (!seen.has(e.to)) copy.children.push(visit(e.to, e.length))
    return copy
  }
  return visit(start, 0)
}

/** Roots the tree at the middle of its longest leaf-to-leaf path. */
export function midpointRoot(root: PhyloNode): PhyloNode {
  const leaves = getLeaves(root)
  if (leaves.length <= 2) return root
  const adj = adjacency(root)
  const { node: end1 } = farthest(leaves[0], adj)
  const { dist: diameter, path } = farthest(end1, adj)

  const half = diameter / 2
  let walked = 0
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]]
    const len = adj.get(a)!.find((e) => e.to === b)!.length
    if (walked + len >= half) {
      const fromA = half - walked
      const mid: PhyloNode = { id: 'midpoint', name: '', length: 0, support: null, children: [] }
      adj.set(mid, [
        { to: a, length: fromA },
        { to: b, length: len - fromA },
      ])
      adj.set(a, [...adj.get(a)!.filter((e) => e.to !== b), { to: mid, length: fromA }])
      adj.set(b, [...adj.get(b)!.filter((e) => e.to !== a), { to: mid, length: len - fromA }])
      return rebuild(mid, adj)
    }
    walked += len
  }
  return root
}

/* ------------------------------ TEsorter classification ------------------------------ */

export interface TEClassification {
  order: string
  superfamily: string
  clade: string
}

/** TREE/TE.cls.tsv: "#TE  Order  Superfamily  Clade  …". */
export function parseClassification(raw: string): Map<string, TEClassification> {
  const map = new Map<string, TEClassification>()
  for (const line of raw.trim().split('\n').slice(1)) {
    const cols = line.split('\t')
    if (cols.length < 4) continue
    const id = cols[0].trim()
    const cls = { order: cols[1].trim(), superfamily: cols[2].trim(), clade: cols[3].trim() }
    map.set(id, cls)
    const clean = id.replace(/[^A-Za-z0-9_]/g, '')
    if (clean !== id) map.set(clean, cls)
  }
  return map
}

/** Clade of a tip: TEsorter table first, then the "#Order/Superfamily/Clade" in the tip name. */
export function cladeOf(tip: string, cls: Map<string, TEClassification>): string | null {
  const id = tip.split(/[#\s]/)[0].replace(/^_+|_+$/g, '')
  const info = cls.get(id) ?? cls.get(id.replace(/_/g, '')) ?? cls.get(tip) ?? null
  if (info && info.clade !== 'unknown' && info.clade !== 'none') return info.clade
  const parts = tip.split('#')[1]?.split('/') ?? []
  return parts[2] ?? info?.superfamily ?? parts[1] ?? null
}
