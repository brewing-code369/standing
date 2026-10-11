import { useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { addressUrl, txUrl } from '../core/chain'
import { navigate } from './lib/router'
import { short } from './lib/format'

/** In-app link: client-side navigation for same-origin paths, plain anchor otherwise. */
export function A({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || !href.startsWith('/') || href.startsWith('//') || href.includes('#')) return
    e.preventDefault()
    navigate(href)
  }
  return (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; busy?: boolean; selected?: boolean; arrow?: boolean }
export function Btn({ variant = 'primary', size = 'md', busy, selected, arrow, className = '', children, disabled, ...rest }: BtnProps) {
  const cls = ['btn', variant === 'ghost' && 'btn--ghost', variant === 'danger' && 'btn--danger', size === 'sm' && 'btn--sm', selected && 'is-selected', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} disabled={disabled || busy} aria-busy={busy || undefined} aria-pressed={selected} {...rest}>
      {children}
      {arrow && <span className="arr" aria-hidden="true" />}
    </button>
  )
}

export function LinkBtn({ href, variant = 'primary', size = 'md', arrow, children }: { href: string; variant?: 'primary' | 'ghost'; size?: 'md' | 'sm'; arrow?: boolean; children: ReactNode }) {
  const cls = ['btn', variant === 'ghost' && 'btn--ghost', size === 'sm' && 'btn--sm'].filter(Boolean).join(' ')
  return (
    <A href={href} className={cls}>
      {children}
      {arrow && <span className="arr" aria-hidden="true" />}
    </A>
  )
}

export type ChipKind = 'active' | 'paid' | 'refused' | 'revoked' | 'wait' | 'ok'
export const Chip = ({ kind, children }: { kind: ChipKind; children: ReactNode }) => <span className={`chip chip--${kind}`}>{children}</span>

export const Tx = ({ hash, label }: { hash: string; label?: string }) => (
  <a className="tx mono" href={txUrl(hash)} target="_blank" rel="noreferrer" title={hash}>
    {label ?? short(hash, 8, 6)}
  </a>
)

export const Addr = ({ address, head = 6, tail = 4 }: { address: string; head?: number; tail?: number }) => (
  <a className="mono" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
    {short(address, head, tail)}
  </a>
)

export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'error'; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice${tone === 'error' ? ' notice--error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="notice__title">{title}</div>
      {children && <p>{children}</p>}
      {action && <div className="row">{action}</div>}
    </div>
  )
}

export const Skeleton = ({ label }: { label: string }) => (
  <div className="skel" role="status" aria-label={label}>
    <i />
    <i />
    <i />
    <span className="label">{label}</span>
  </div>
)

export function Copy({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Btn
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? 'Copied' : label}
    </Btn>
  )
}

export const Rails = () => <div className="rails" aria-hidden="true" />
