import { useCallback, useEffect, useState } from 'react'

const EVENT = 'standing:navigate'

export const navigate = (to: string) => {
  if (to === location.pathname) return window.scrollTo(0, 0)
  history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo(0, 0)
}

export function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const sync = () => setPath(location.pathname)
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [])
  return path
}

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'plan'; planId: string }
  | { name: 'member'; planId: string; account: string }
  | { name: 'missing'; path: string }

export function matchRoute(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/') return { name: 'home' }
  if (p === '/new') return { name: 'new' }
  const plan = /^\/p\/([0-9a-f]{8})$/.exec(p)
  if (plan) return { name: 'plan', planId: plan[1] }
  const member = /^\/m\/([0-9a-f]{8})\/(0x[0-9a-fA-F]{40})$/.exec(p)
  if (member) return { name: 'member', planId: member[1], account: member[2] }
  return { name: 'missing', path: p }
}

export type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: Error }

/** Runs `load` on mount and whenever `deps` change; `reload` runs it again without flashing back to loading. */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[]): Resource<T> & { reload: () => void } {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    if (tick === 0) setState({ status: 'loading' })
    load().then(
      (data) => live && setState({ status: 'ready', data }),
      (e) => live && setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
