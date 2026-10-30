import styles from './Switch.module.scss'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  /** Extra description read by screen readers (e.g. why it is locked). */
  describedBy?: string
}

/** Toggle button with role="switch". */
export function Switch({ checked, onChange, label, disabled, describedBy }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    />
  )
}
