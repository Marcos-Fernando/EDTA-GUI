import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TENode, TEReportMeta, TESelection } from './parse/teReport'
import styles from './Report.module.scss'

const fmt = (n: number | null) => (n === null ? '' : n.toLocaleString('en-GB'))

interface RowProps {
  node: TENode
  depth: number
  path: string
  selectedKey: string | null
  onSelect?: (selection: TESelection) => void
}

function Row({ node, depth, path, selectedKey, onSelect }: RowProps) {
  const [open, setOpen] = useState(depth < 1)
  const parent = node.children.length > 0
  const selectable = !!onSelect && node.lengthBp !== null
  const selected = selectedKey === path
  const select = () => {
    if (selectable) onSelect({ key: path, name: node.name, lengthBp: node.lengthBp as number })
  }

  return (
    <>
      <div
        className={`${styles.teRow} ${selectable ? styles.teSelectable : ''} ${
          selected ? styles.teSelected : ''
        }`}
        role="row"
        aria-level={depth + 1}
        aria-expanded={parent ? open : undefined}
        aria-selected={selectable ? selected : undefined}
        tabIndex={selectable ? 0 : undefined}
        title={selectable ? 'Show this category in the chart' : undefined}
        onClick={select}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            select()
          }
        }}
      >
        <span role="gridcell" className={styles.teName} style={{ paddingLeft: depth * 18 }}>
          {parent ? (
            <button
              type="button"
              className={styles.teToggle}
              onClick={(e) => {
                e.stopPropagation()
                setOpen((o) => !o)
              }}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            >
              <ChevronRight
                size={13}
                aria-hidden="true"
                className={open ? styles.rotated : undefined}
              />
            </button>
          ) : (
            <span className={styles.teToggle} aria-hidden="true" />
          )}
          <span className={parent ? styles.strong : undefined}>{node.name}</span>
        </span>
        <span role="gridcell" className={styles.teBar} aria-hidden="true">
          {node.percentage !== null && (
            <i style={{ width: `${Math.min(node.percentage * 5, 100)}%` }} />
          )}
        </span>
        <span role="gridcell" className={styles.num}>
          {fmt(node.elements)}
        </span>
        <span role="gridcell" className={styles.num}>
          {node.lengthBp === null ? '' : `${fmt(node.lengthBp)} bp`}
        </span>
        <span role="gridcell" className={`${styles.num} ${styles.pct}`}>
          {node.percentage === null ? '' : `${node.percentage.toFixed(2)}%`}
        </span>
      </div>
      {parent &&
        open &&
        node.children.map((c, i) => (
          <Row
            key={`${c.name}-${i}`}
            node={c}
            depth={depth + 1}
            path={`${path}/${c.name}-${i}`}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

/**
 * RepeatMasker TE table as an expandable tree (Class → Order → Superfamily → Lineage).
 * With `onSelect`, a row with a length can be clicked (or Enter/Space) to select it.
 */
export function TETable({
  meta,
  tree,
  selectedKey = null,
  onSelect,
}: {
  meta: TEReportMeta
  tree: TENode[]
  selectedKey?: string | null
  onSelect?: (selection: TESelection) => void
}) {
  return (
    <div className={styles.teTable}>
      <dl className={styles.teMeta}>
        {meta.sequences && (
          <div>
            <dt>Sequences</dt>
            <dd>{meta.sequences}</dd>
          </div>
        )}
        {meta.totalLength && (
          <div>
            <dt>Total length</dt>
            <dd>{meta.totalLength}</dd>
          </div>
        )}
        {meta.basesMasked && (
          <div>
            <dt>Bases masked</dt>
            <dd>{meta.basesMasked}</dd>
          </div>
        )}
      </dl>
      <div className={styles.teScroll} role="treegrid" aria-label="TE classification">
        <div className={`${styles.teRow} ${styles.teHead}`} role="row">
          <span role="columnheader">Category</span>
          <span role="columnheader" className={styles.teBar}>
            Proportion
          </span>
          <span role="columnheader" className={styles.num}>
            Elements
          </span>
          <span role="columnheader" className={styles.num}>
            Length
          </span>
          <span role="columnheader" className={styles.num}>
            %
          </span>
        </div>
        {tree.map((n, i) => (
          <Row
            key={`${n.name}-${i}`}
            node={n}
            depth={0}
            path={`${n.name}-${i}`}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
