import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import fieldStyles from './Field.module.scss'
import styles from './TestRunButton.module.scss'

interface Props {
  /** What the test runs and how long it takes (shown below the button). */
  description: string
  /** Question of the confirmation dialog. */
  confirmText: string
  /** Loads the test files, fills the form and starts the run. */
  onRun: () => Promise<void>
}

/** "Run test analysis": asks for confirmation, then fills the form and starts the run. */
export function TestRunButton({ description, confirmText, onRun }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!window.confirm(confirmText)) return
    setError(null)
    setBusy(true)
    try {
      await onRun()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.block}>
      <button
        type="button"
        className={fieldStyles.btnSecondary}
        disabled={busy}
        aria-describedby="test-run-hint"
        onClick={run}
      >
        <FlaskConical size={14} aria-hidden="true" />
        {busy ? 'Loading test data…' : 'Run test analysis'}
      </button>
      <span id="test-run-hint" className={fieldStyles.hint}>
        {description}
      </span>
      {error && (
        <span className={fieldStyles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
