import { useEffect, useState } from 'react'
import type { EngineHealth } from '../services'
import { useAppState, usePipelineService } from '../state/hooks'
import styles from './Shell.module.scss'

const HEALTH_REFRESH_MS = 30_000

export function StatusBar({ pipeline }: { pipeline: string }) {
  const { theme } = useAppState()
  const service = usePipelineService()
  const [health, setHealth] = useState<EngineHealth | null>(null)

  useEffect(() => {
    let alive = true
    const check = () =>
      service.health().then((h) => {
        if (alive) setHealth(h)
      })
    check()
    const id = setInterval(check, HEALTH_REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [service])

  const dotClass =
    service.kind === 'mock' ? styles.dotMock : health && !health.ok ? styles.dotError : ''

  return (
    <footer className={styles.statusbar}>
      <span role="status">
        <span className={`${styles.dot} ${dotClass}`} aria-hidden="true" />
        {health?.label ?? 'checking engine…'}
      </span>
      <span className={styles.hideSm}>pipeline: {pipeline}</span>
      <span />
      <span className={styles.hideSm}>v{__APP_VERSION__}</span>
      <span>theme: {theme}</span>
    </footer>
  )
}
