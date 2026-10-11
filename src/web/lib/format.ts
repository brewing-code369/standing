import { usd } from '../../core/plan'

export const short = (a: string, head = 6, tail = 4) => `${a.slice(0, head)}…${a.slice(-tail)}`

/** "10.00", "1.90": always at least two decimals, never more than six. */
export function money(v: bigint): string {
  const s = usd(v)
  const [i, f = ''] = s.split('.')
  return `${i}.${f.padEnd(2, '0')}`
}

export function countdown(seconds: number): string {
  if (seconds <= 0) return 'due now'
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3_600)
  const m = Math.floor((seconds % 3_600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export const dateTime = (unix: number) =>
  new Date(unix * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export const REFUSALS: Record<string, string> = {
  SpendingLimitExceeded: 'This key already pulled its cap for the period. The account holds the rest.',
  CallNotAllowed: 'This key may call one function, to one address. Anything else is rejected before it executes.',
  KeyAlreadyRevoked: 'The member cancelled. The key no longer exists on their account.',
  KeyNotFound: 'This account never installed that key.',
  KeyExpired: 'The key reached its expiry.',
  InsufficientBalance: 'The account cannot cover this pull.',
  Unauthorized: 'The account did not authorize this key.',
}
export const refusalMeaning = (name: string) => REFUSALS[name] ?? 'The chain rejected the transaction.'

/** One readable line for a failed chain or network call. */
export function plainError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('KeyAlreadyExists')) return 'This account already holds these keys. Open its membership instead.'
  if (m.includes('KeyAlreadyRevoked')) return 'This account cancelled these keys and the chain does not reinstate them. Use a fresh key.'
  if (/rate limited|exceeds defined limit/i.test(m)) return 'The network asked for a short pause. Try again in a few seconds.'
  if (/user rejected|NotAllowedError|cancelled|canceled/i.test(m)) return 'The signature was not given.'
  return m.split('\n')[0].slice(0, 240)
}
