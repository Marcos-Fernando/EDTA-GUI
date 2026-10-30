import { Play } from 'lucide-react'
import { CommandPreview } from '../components/CommandPreview'
import styles from './PageLayout.module.scss'

interface Props {
  commands: string[][] | null
  /** Messages of required fields still missing (shown instead of inline errors). */
  missing: string[]
  /** Fields with invalid values (shown inline; listed here only as a count). */
  invalidCount: number
  submitting: boolean
  submitError: string | null
  onSubmit: () => void
}

/** Sidebar footer: command preview, what is missing, start button (no alert()). */
export function SubmitFooter({
  commands,
  missing,
  invalidCount,
  submitting,
  submitError,
  onSubmit,
}: Props) {
  const blocked = missing.length > 0 || invalidCount > 0
  return (
    <div className={styles.footer}>
      <CommandPreview commands={commands} />
      {blocked && (
        <ul className={styles.missing} aria-live="polite" id="submit-blockers">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
          {invalidCount > 0 && (
            <li>
              Fix {invalidCount} highlighted field{invalidCount > 1 ? 's' : ''}.
            </li>
          )}
        </ul>
      )}
      {submitError && (
        <p className={styles.submitError} role="alert">
          {submitError}
        </p>
      )}
      <button
        type="button"
        className={styles.btnPrimary}
        disabled={blocked || submitting}
        aria-describedby={blocked ? 'submit-blockers' : undefined}
        onClick={onSubmit}
      >
        <Play size={15} aria-hidden="true" />
        {submitting ? 'Starting…' : 'Start annotation'}
      </button>
      <p className={styles.envNote}>
        Performance depends on the local machine. Keep it powered on while the run is in progress.
      </p>
    </div>
  )
}
