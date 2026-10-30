/**
 * Client-side mirror of werkzeug's secure_filename, used for previews only.
 * The backend sanitizes again and is the source of truth.
 */
export function secureFilename(name: string): string {
  const ascii = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')
  const joined = ascii.replace(/[/\\]/g, ' ').trim().split(/\s+/).join('_')
  return joined.replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[._]+|[._]+$/g, '')
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

export function hasAllowedExtension(name: string, allowed: readonly string[]): boolean {
  return allowed.length === 0 || allowed.includes(extensionOf(name))
}

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** 1536 → "1.5 KB" (binary units, one decimal). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`
}

/** 30427671 → "30.4 Mb" (genome sizes, decimal units as biologists use). */
export function formatBp(bp: number): string {
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(2)} Gb`
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)} Mb`
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)} kb`
  return `${bp} bp`
}
