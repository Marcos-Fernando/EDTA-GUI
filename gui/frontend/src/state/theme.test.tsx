import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from '../test/utils'

const KEY = 'edta-gui-theme'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('theme', () => {
  it('starts light even when the OS prefers dark, and saves nothing until the user toggles', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark'), media: q }))
    const { user } = renderApp()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(KEY)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
  })

  it('restores the saved choice', () => {
    localStorage.setItem(KEY, 'dark')
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('ignores the old key that could hold the OS preference', () => {
    localStorage.setItem('edta-theme', 'dark')
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
