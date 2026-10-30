import { useEffect, useRef, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { ABOUT, GUIDE, type GuideBlock, type GuideSection } from '../content/guide'
import { hrefFor } from '../hooks/useHashRoute'
import styles from './GuidePage.module.scss'

const URL_RE = /(https?:\/\/[^\s)]+[^\s).,;:])/g

/** Plain text with `code` spans and clickable URLs. */
function Rich({ text }: { text: string }) {
  const out: ReactNode[] = []
  text.split(/(`[^`]+`)/g).forEach((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      out.push(<code key={i}>{part.slice(1, -1)}</code>)
      return
    }
    part.split(URL_RE).forEach((piece, j) => {
      if (!piece) return
      out.push(
        URL_RE.test(piece) ? (
          <a key={`${i}-${j}`} href={piece} target="_blank" rel="noreferrer">
            {piece}
          </a>
        ) : (
          piece
        ),
      )
      URL_RE.lastIndex = 0
    })
  })
  return <>{out}</>
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <Rich text={block.text} />
        </p>
      )
    case 'h':
      return <h3>{block.text}</h3>
    case 'note':
      return (
        <p className={styles.note}>
          <Rich text={block.text} />
        </p>
      )
    case 'code':
      return (
        <pre className={styles.code}>
          <code>{block.text}</code>
        </pre>
      )
    case 'link':
      return (
        <p>
          <a href={block.href} target="_blank" rel="noreferrer">
            {block.text}
          </a>
        </p>
      )
    case 'list':
      return (
        <ul>
          {block.items.map((it, i) => (
            <li key={i}>
              {it.term && <strong>{it.term} </strong>}
              <Rich text={it.text} />
            </li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className={styles.steps}>
          {block.items.map((text, i) => (
            <li key={i}>
              <Rich text={text} />
            </li>
          ))}
        </ol>
      )
    case 'table':
      return (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {block.head.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td key={j}>
                      <Rich text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Section({ section, num }: { section: GuideSection; num?: number }) {
  return (
    <section
      id={`guide-${section.id}`}
      className={styles.section}
      aria-labelledby={`guide-${section.id}-title`}
    >
      <h2 id={`guide-${section.id}-title`} tabIndex={-1}>
        {num !== undefined && <span className={styles.num}>{String(num).padStart(2, '0')}</span>}
        {section.title}
      </h2>
      {section.lead && (
        <p className={styles.lead}>
          <Rich text={section.lead} />
        </p>
      )}
      {section.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </section>
  )
}

/** About + user guide. The address #/guide/<id> opens a section directly. */
export function GuidePage({ section }: { section?: string }) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = section ? document.getElementById(`guide-${section}-title`) : null
    if (target) {
      target.scrollIntoView?.({ block: 'start' })
      target.focus({ preventScroll: true })
    } else {
      scroller.current?.scrollTo?.({ top: 0 })
    }
  }, [section])

  const goTo = (id: string) => () => {
    // same hash again: no hashchange event, so scroll here
    if (section === id) {
      const target = document.getElementById(`guide-${id}-title`)
      target?.scrollIntoView?.({ block: 'start' })
      target?.focus({ preventScroll: true })
    }
  }

  return (
    <div className={styles.page} ref={scroller}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>
          <Info size={12} aria-hidden="true" /> About
        </p>
        <h2>About and user guide</h2>
        <p className={styles.sub}>
          From installing the tool to finding your results on this computer.
        </p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Guide contents">
          <ol>
            <li>
              <a href={hrefFor({ page: 'guide', section: ABOUT.id })} onClick={goTo(ABOUT.id)}>
                {ABOUT.title}
              </a>
            </li>
          </ol>
          <p className={styles.tocLabel}>User guide</p>
          <ol>
            {GUIDE.map((s, i) => (
              <li key={s.id}>
                <a
                  href={hrefFor({ page: 'guide', section: s.id })}
                  aria-current={section === s.id ? 'location' : undefined}
                  onClick={goTo(s.id)}
                >
                  <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.article}>
          <Section section={ABOUT} />
          <h2 className={styles.partTitle}>User guide</h2>
          {GUIDE.map((s, i) => (
            <Section key={s.id} section={s} num={i + 1} />
          ))}
        </article>
      </div>
    </div>
  )
}
