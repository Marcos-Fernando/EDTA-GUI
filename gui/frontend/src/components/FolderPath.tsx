import { useState } from 'react'
import { Check, Copy, FolderOpen } from 'lucide-react'
import styles from './FolderPath.module.scss'
/** Where the run folder lives on the backend machine, with a copy button. */
export function FolderPath({ path }: { path: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied('ok')
    } catch {
      // clipboard needs a secure context (localhost or https); the text stays selectable
      setCopied('fail')
    }
    window.setTimeout(() => setCopied('idle'), 1500)
  }

  return (
    <p className={styles.path}>
      <FolderOpen size={13} aria-hidden="true" />
      <span className={styles.pathText} title={path}>
        <span className={styles.srOnly}>Saved in </span>
        {path}
      </span>
      <button
        type="button"
        className={styles.copy}
        onClick={copy}
        aria-label="Copy folder path"
        title="Copy folder path"
      >
        {copied === 'ok' ? (
          <Check size={12} aria-hidden="true" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
      <span className={styles.copyStatus} role="status">
        {copied === 'ok'
          ? 'Copied'
          : copied === 'fail'
            ? 'Copy not available, select the text'
            : ''}
      </span>
    </p>
  )
}
