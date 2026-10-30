import { useMemo, useState } from 'react'
import 'katucharts.js/bio'
import { SegmentedControl } from '../../components/SegmentedControl'
import {
  cladeOf,
  getLeaves,
  midpointRoot,
  parseClassification,
  parseNewick,
  type PhyloNode,
} from '../parse/newick'
import { KatuChart } from './KatuChart'
import { LABEL_PX, LEAF_PADDING, radialTreeSize } from './phyloLayout'
import styles from '../Report.module.scss'

const PALETTE = [
  '#1b9e77',
  '#d95f02',
  '#7570b3',
  '#e7298a',
  '#66a61e',
  '#e6ab02',
  '#a6761d',
  '#666666',
  '#377eb8',
  '#e41a1c',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#a65628',
  '#f781bf',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#fccde5',
  '#bc80bd',
  '#ccebc5',
  '#ffed6f',
  '#8dd3c7',
  '#bebada',
]

interface KatuTreeNode {
  name: string
  branchLength?: number
  children?: KatuTreeNode[]
  custom: { bootstrap?: number; color?: string; clade?: string; tooltipText?: string }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function toKatu(
  node: PhyloNode,
  clades: Map<PhyloNode, string | null>,
  colors: Map<string, string>,
): KatuTreeNode {
  const leaf = node.children.length === 0
  const clade = leaf ? (clades.get(node) ?? null) : null
  const name = leaf ? node.name.replace(/\W+/g, '_') : node.name
  // IQ-TREE writes 0–1 support; scale to percent
  const bootstrap =
    !leaf && node.support !== null
      ? Math.round(node.support <= 1 ? node.support * 100 : node.support)
      : undefined

  const tip = [`<b>${escapeHtml(name || '(internal node)')}</b>`]
  if (clade) tip.push(`Clade: ${escapeHtml(clade)}`)
  if (node.length) tip.push(`Branch length: ${node.length.toFixed(4)}`)
  if (bootstrap !== undefined) tip.push(`Bootstrap: ${bootstrap}%`)

  return {
    name,
    branchLength: node.length,
    custom: {
      ...(clade ? { clade, color: colors.get(clade) } : {}),
      ...(bootstrap !== undefined ? { bootstrap } : {}),
      tooltipText: tip.join('<br/>'),
    },
    ...(leaf ? {} : { children: node.children.map((c) => toKatu(c, clades, colors)) }),
  }
}

type Layout = 'cladogram' | 'phylogram'

export function PhyloTreeChart({
  newick,
  classification,
}: {
  newick: string
  classification: string | null
}) {
  const [layout, setLayout] = useState<Layout>('cladogram')

  const tree = useMemo(() => {
    const rooted = midpointRoot(parseNewick(newick))
    const cls = classification ? parseClassification(classification) : new Map()
    const leaves = getLeaves(rooted)
    const clades = new Map(leaves.map((l) => [l, cladeOf(l.name, cls)] as const))
    const counts = new Map<string, number>()
    for (const c of clades.values()) if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const colors = new Map(ordered.map(([c], i) => [c, PALETTE[i % PALETTE.length]]))
    const box = radialTreeSize(leaves.map((l) => l.name.replace(/\W+/g, '_')))
    return { data: toKatu(rooted, clades, colors), leaves: leaves.length, ordered, colors, box }
  }, [newick, classification])

  const { size, spacing } = tree.box
  const options = {
    chart: {
      type: 'phylotree',
      width: size,
      height: size,
      backgroundColor: 'transparent',
      spacing: [spacing, spacing, spacing, spacing],
    },
    title: { text: '' },
    // clade legend is drawn in HTML below the toolbar, so it never takes room from the tree
    legend: { enabled: false },
    tooltip: {
      useHTML: true,
      headerFormat: '',
      formatter(this: { point: { name: string; custom?: { tooltipText?: string } } }) {
        return this.point.custom?.tooltipText ?? this.point.name
      },
    },
    series: [
      {
        type: 'phylotree',
        layout: 'radial',
        showBranchLengths: layout === 'phylogram',
        showBootstrap: true,
        showInLegend: false,
        leafLabelSize: LABEL_PX,
        leafPadding: LEAF_PADDING,
        branchWidth: 1.2,
        name: 'Tree',
        data: [tree.data],
        colorByPoint: true,
      },
    ],
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <SegmentedControl
          label="Tree layout"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'cladogram', label: 'Cladogram' },
            { value: 'phylogram', label: 'Phylogram' },
          ]}
        />
        <span className={styles.muted}>
          {tree.leaves} LTR elements · {tree.ordered.length} clades
        </span>
      </div>
      {tree.ordered.length > 0 && (
        <ul className={styles.legend} aria-label="Clades">
          {tree.ordered.map(([clade, n]) => (
            <li key={clade}>
              <span
                className={styles.swatch}
                style={{ background: tree.colors.get(clade) }}
                aria-hidden="true"
              />
              {clade} ({n})
            </li>
          ))}
        </ul>
      )}
      <div
        className={styles.scrollBoth}
        tabIndex={0}
        aria-label="LTR phylogenetic tree (scrollable)"
      >
        <KatuChart options={options} height={size} width={size} />
      </div>
    </div>
  )
}
