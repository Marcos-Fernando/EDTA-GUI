import { useId, type ReactNode } from 'react'
import styles from './Field.module.scss'

interface Props {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string | null
  hint?: ReactNode
  placeholder?: string
  title?: string
  type?: 'text' | 'email'
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
  numeric?: boolean
  compactLabel?: boolean
  required?: boolean
  autoComplete?: string
}

/** Labelled input with inline error (aria-invalid + aria-describedby). */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  title,
  type = 'text',
  inputMode,
  numeric,
  compactLabel,
  required,
  autoComplete,
}: Props) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <label
        htmlFor={id}
        title={title}
        className={`${styles.label} ${compactLabel ? styles.labelCompact : ''}`}
      >
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        className={`${styles.input} ${numeric ? styles.num : ''}`}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        title={title}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
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
