import { useEffect, useState } from 'react'

export type RunTab = 'execution' | 'report'

export type Route =
  | { page: 'edta' }
  | { page: 'pan' }
  | { page: 'results' }
  | { page: 'guide'; section?: string }
  | { page: 'run'; runId: string; tab?: RunTab }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, ...rest] = path.split('/')
  if (head === 'pan') return { page: 'pan' }
  if (head === 'results') return { page: 'results' }
  if (head === 'guide') return rest[0] ? { page: 'guide', section: rest[0] } : { page: 'guide' }
  if (head === 'runs' && rest.length > 0) {
    // run ids never contain "/" (encoded anyway): "#/runs/<id>[/report]"
    const tab: RunTab = rest[1] === 'report' ? 'report' : 'execution'
    return { page: 'run', runId: decodeURIComponent(rest[0]), tab }
  }
  return { page: 'edta' }
}

export function hrefFor(route: Route): string {
  if (route.page === 'guide') return route.section ? `#/guide/${route.section}` : '#/guide'
  if (route.page !== 'run') return `#/${route.page}`
  const base = `#/runs/${encodeURIComponent(route.runId)}`
  return route.tab === 'report' ? `${base}/report` : base
}

/** Minimal hash router: deep links and the back button work without a routing library. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
