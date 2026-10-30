import { Info, Moon, Sun } from 'lucide-react'
import { hrefFor, type Route } from '../hooks/useHashRoute'
import { useAppDispatch, useAppState } from '../state/hooks'
import { saveTheme } from '../state/theme'
import styles from './Shell.module.scss'

const PAGES: { page: 'edta' | 'pan' | 'results'; label: string }[] = [
  { page: 'edta', label: 'EDTA-GUI' },
  { page: 'pan', label: 'panEDTA-GUI' },
  { page: 'results', label: 'Results' },
]

interface Props {
  route: Route
  /** Brand icon (src/assets/brand/*.svg). */
  icon: string
  title: string
  subtitle: string
}

/** Prototype header: brand | page tabs (navigation option B) | actions. */
export function Header({ route, icon, title, subtitle }: Props) {
  const { theme } = useAppState()
  const dispatch = useAppDispatch()
  const activePage = route.page === 'run' ? 'results' : route.page
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img className={styles.mark} src={icon} alt="" aria-hidden="true" />
        <div className={styles.brandText}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <nav className={styles.pages} aria-label="Pages">
        {PAGES.map((p) => (
          <a
            key={p.page}
            href={hrefFor({ page: p.page })}
            className={activePage === p.page ? styles.active : undefined}
            aria-current={activePage === p.page ? 'page' : undefined}
          >
            {p.label}
          </a>
        ))}
      </nav>

      <div className={styles.actions}>
        <a
          href={hrefFor({ page: 'guide' })}
          className={styles.aboutBtn}
          aria-current={route.page === 'guide' ? 'page' : undefined}
        >
          <Info size={15} aria-hidden="true" />
          About
        </a>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Switch to ${next} theme`}
          title={`Switch to ${next} theme`}
          onClick={() => {
            saveTheme(next)
            dispatch({ type: 'theme/set', theme: next })
          }}
        >
          {theme === 'dark' ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  )
}
