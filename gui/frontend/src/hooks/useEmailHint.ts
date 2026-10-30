import { useEffect, useState } from 'react'
import { usePipelineService } from '../state/hooks'

export const EMAIL_HINT = 'Optional. Notifications about the run are sent here.'
export const EMAIL_DISABLED_HINT =
  'E-mail is not set up on this server (MAIL_SERVER is empty), so no message will be sent. ' +
  'Follow the run in Results.'

/** Hint for the e-mail field; warns when the backend cannot send e-mails. */
export function useEmailHint(): string {
  const service = usePipelineService()
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    service
      .health()
      .then((h) => {
        if (alive) setMailConfigured(h.mailConfigured)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [service])

  return mailConfigured === false ? EMAIL_DISABLED_HINT : EMAIL_HINT
}
