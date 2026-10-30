import { useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Field.module.scss'

interface Props {
  label: ReactNode
  file: File | null
  onChange: (file: File | null) => void
  /** Extensions such as ".fa"; empty = any file. */
  accept?: readonly string[]
  placeholder?: string
  disabled?: boolean
  disabledReason?: string
  error?: string | null
  hint?: ReactNode
  required?: boolean
  /** Plain-text field name for the buttons ("Browse: <name>", "Clear: <name>") when label is not a string. */
  name?: string
}

/** Read-only name box + "Browse…" button + clear button. */
export function FileInput({
  label,
  file,
  onChange,
  accept = [],
  placeholder = 'none selected',
  disabled,
  disabledReason,
  error,
  hint,
  required,
  name,
}: Props) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = `${id}-label`
  const nameId = `${id}-name`
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const help = disabled && disabledReason ? disabledReason : hint
  const fieldName = name ?? (typeof label === 'string' ? label : 'file')
  const describedBy = [nameId, help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className={styles.browseRow}>
        <input
          id={nameId}
          className={styles.input}
          type="text"
          readOnly
          tabIndex={-1}
          value={file?.name ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-label={`Browse: ${fieldName}`}
          onClick={() => inputRef.current?.click()}
        >
          Browse…
        </button>
        <button
          type="button"
          className={`${styles.btnSecondary} ${styles.iconBtn}`}
          disabled={disabled || !file}
          aria-label={`Clear: ${fieldName}`}
          title="Clear"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = ''
            onChange(null)
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept.length ? accept.join(',') : undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
      {help && (
        <span id={helpId} className={styles.hint}>
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
