import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { formatCommand } from '../config/commandBuilder'
import styles from './CommandPreview.module.scss'

interface Props {
  /** Argument lists, executed in order (AnnoTEP adds the report script). */
  commands: string[][] | null
  /** Shown when the form is not valid yet. */
  placeholder?: string
}

/** Collapsible preview of the command line built from the same config the backend uses. */
export function CommandPreview({
  commands,
  placeholder = 'Complete the form to see the command.',
}: Props) {
  const [copied, setCopied] = useState(false)
  const text = commands?.map(formatCommand).join('\n') ?? ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <details className={styles.preview}>
      <summary>Command preview</summary>
      <div className={styles.body}>
        {commands ? (
          <>
            <pre>
              <code>{text}</code>
            </pre>
            <button type="button" className={styles.copy} onClick={copy} aria-label="Copy command">
              {copied ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
            </button>
          </>
        ) : (
          <p className={styles.placeholder}>{placeholder}</p>
        )}
      </div>
    </details>
  )
}
