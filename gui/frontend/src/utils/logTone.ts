/** Colour hint for a log line (presentation only). */
export function lineTone(line: string): 'ok' | 'warn' | 'error' | null {
  if (/\bERROR\b|\[Pipeline Error\]|cancelled by user|Aborting execution/i.test(line))
    return 'error'
  if (/\bwarning\b/i.test(line)) return 'warn'
  if (/finished!|has been completed|completed successfully|All passed!/i.test(line)) return 'ok'
  return null
}
