import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { GUIDE } from '../content/guide'
import { renderApp } from '../test/utils'

const escape = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const headerAbout = () => within(screen.getByRole('banner')).getByRole('link', { name: 'About' })

describe('About and user guide page', () => {
  it('opens from the About button of the header', async () => {
    const { user } = renderApp('#/edta')
    await user.click(headerAbout())
    expect(window.location.hash).toBe('#/guide')
    expect(await screen.findByRole('heading', { name: 'About and user guide' })).toBeInTheDocument()
    expect(headerAbout()).toHaveAttribute('aria-current', 'page')
  })

  it('starts with About, then lists every guide section in the contents', () => {
    renderApp('#/guide')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.indexOf('About')).toBeLessThan(headings.indexOf('User guide'))

    const toc = screen.getByRole('navigation', { name: 'Guide contents' })
    for (const s of GUIDE) {
      expect(within(toc).getByRole('link', { name: escape(s.title) })).toHaveAttribute(
        'href',
        `#/guide/${s.id}`,
      )
      expect(screen.getByRole('region', { name: escape(s.title) })).toBeInTheDocument()
    }
  })

  it('opens a section from its address and focuses its title', () => {
    renderApp('#/guide/storage')
    const title = screen.getByRole('heading', { name: /Where your data is stored/ })
    expect(title).toHaveFocus()
    const toc = screen.getByRole('navigation', { name: 'Guide contents' })
    expect(within(toc).getByRole('link', { name: /Where your data is stored/ })).toHaveAttribute(
      'aria-current',
      'location',
    )
  })

  it('covers only the open tool: no installation steps, code spans and the article link', () => {
    renderApp('#/guide')
    expect(screen.queryByText(/start\.sh/)).toBeNull()
    expect(screen.queryByRole('heading', { name: /Install/ })).toBeNull()
    expect(screen.getAllByText('status.txt')[0].tagName).toBe('CODE')
    expect(screen.getByRole('link', { name: 'doi:10.1186/s12864-026-12588-z' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1186/s12864-026-12588-z',
    )
  })
})
