import { Check, X } from 'lucide-react'
import type { DetectedStep } from '../config/stepMatchers'
import type { StepState } from '../types'
import styles from './Timeline.module.scss'

const STATE_LABEL: Record<StepState, string> = {
  pending: 'pending',
  running: 'in progress',
  done: 'completed',
  skipped: 'skipped',
  failed: 'failed',
}

interface Props {
  steps: DetectedStep[]
}

/** Execution timeline. States come from the step matchers. */
export function Timeline({ steps }: Props) {
  return (
    <ol className={styles.steps}>
      {steps.map(({ def, state }, i) => (
        <li
          key={def.id}
          className={`${styles.step} ${styles[state]}`}
          aria-current={state === 'running' ? 'step' : undefined}
        >
          <div className={styles.node} aria-hidden="true">
            {state === 'done' ? (
              <Check size={13} strokeWidth={3} />
            ) : state === 'failed' ? (
              <X size={13} strokeWidth={3} />
            ) : (
              i + 1
            )}
          </div>
          <div>
            <div className={styles.head}>
              <span className={styles.title}>{def.title}</span>
              <span className={styles.tag}>{STATE_LABEL[state]}</span>
            </div>
            <div className={styles.desc}>{def.description}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
