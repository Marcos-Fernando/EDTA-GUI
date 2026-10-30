import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { HELP, type HelpKey } from '../content/help'
import styles from './HelpPopover.module.scss'

interface Props {
  topic: HelpKey
}

/**
 * Help icon that opens a side panel with the migrated legacy help text
 * (legacy .help-sidebar). Esc or the close button closes it and focus returns
 * to the icon.
 */
export function HelpPopover({ topic }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const titleId = `${panelId}-title`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const content = HELP[topic]

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`Help: ${content.title}`}
        title={`Help: ${content.title}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <aside id={panelId} role="dialog" aria-labelledby={titleId} className={styles.panel}>
            <div className={styles.head}>
              <h2 id={titleId}>{content.title}</h2>
              <button
                ref={closeRef}
                type="button"
                className={styles.close}
                aria-label="Close help"
                onClick={close}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.body}>
              {content.blocks.map((b, i) => {
                switch (b.type) {
                  case 'h':
                    return <h3 key={i}>{b.text}</h3>
                  case 'p':
                    return <p key={i}>{b.text}</p>
                  case 'link':
                    return (
                      <p key={i}>
                        <a href={b.href} target="_blank" rel="noreferrer">
                          {b.text}
                        </a>
                      </p>
                    )
                  case 'list':
                    return (
                      <ul key={i}>
                        {b.items.map((it, j) => (
                          <li key={j}>
                            {it.term && <strong>{it.term}: </strong>}
                            {it.text}
                          </li>
                        ))}
                      </ul>
                    )
                }
              })}
            </div>
          </aside>,
          document.body,
        )}
    </>
  )
}
