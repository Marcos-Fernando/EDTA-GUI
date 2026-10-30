const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Folder timestamp used by the legacy GUI: YYYYmmdd-HHMMSS */
export function folderTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/** Display format of the legacy Results page: YYYY/MM/DD HH:MM:SS */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** Elapsed time as HH:MM:SS (or MM:SS under one hour). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function durationBetween(startIso: string | null, endIso: string | null, now = Date.now()) {
  if (!startIso) return null
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : now
  return Number.isNaN(start) || Number.isNaN(end) ? null : end - start
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Imitates the output of `date` (C locale), as printed by EDTA.pl / panEDTA.sh. Mock only. */
export function unixDate(d: Date): string {
  return (
    `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getFullYear()}`
  )
}
