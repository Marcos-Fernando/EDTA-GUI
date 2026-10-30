import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../app/App'
import { AppProvider } from '../state/AppProvider'
import { MockPipelineService, type MockOptions } from '../services/MockPipelineService'

export function renderApp(
  hash = '#/edta',
  options: MockOptions = { lineDelayMs: 1, seed: false },
  notifyIntervalMs?: number,
) {
  window.location.hash = hash
  const service = new MockPipelineService(options)
  const user = userEvent.setup()
  const utils = render(
    <AppProvider service={service} notifyIntervalMs={notifyIntervalMs}>
      <App />
    </AppProvider>,
  )
  return { ...utils, user, service }
}

export const fasta = (name: string) =>
  new File(['>chr01\nACGTACGT\n'], name, { type: 'text/plain' })

/** Hidden <input type=file> of the field whose "Browse: <name>" button matches. */
export function fileInputFor(fieldName: string): HTMLInputElement {
  const button = screen.getByRole('button', { name: `Browse: ${fieldName}` })
  const input = button.parentElement?.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error(`No file input for ${fieldName}`)
  return input
}
