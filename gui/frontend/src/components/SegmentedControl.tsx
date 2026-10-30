import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './SegmentedControl.module.scss'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label: string
  labelledBy?: string
  size?: 'md' | 'lg'
  disabled?: boolean
}

/**
 * Accessible radiogroup: one tab stop,
 * arrow keys / Home / End move and select.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  size = 'md',
  disabled,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const move = (index: number) => {
    const i = (index + options.length) % options.length
    onChange(options[i].value)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: options.length - 1,
    }
    if (e.key in keys) {
      e.preventDefault()
      move(keys[e.key])
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={`${styles.segmented} ${size === 'lg' ? styles.lg : ''}`}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {options.map((o, i) => {
        const active = i === current
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            className={active ? styles.active : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
