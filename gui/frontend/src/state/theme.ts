import type { Theme } from './appState'

/** Renamed from "edta-theme": that key could hold a value copied from the OS, not chosen. */
const THEME_KEY = 'edta-gui-theme'

/** Saved choice, else light (the OS preference is not followed). Storage may be unavailable. */
export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Called only when the user toggles the theme. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}
