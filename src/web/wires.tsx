import type { ReactNode } from 'react'
import { isAddressEqual, type Address } from 'viem'
import type { RoleState } from '../core/membership'
import { periodLabel, price, ROLES, type Role } from '../core/plan'
import { countdown, money, short } from './lib/format'
import { Addr, Chip } from './ui'

export type CardPlan = {
  shares: Record<Role, bigint>
  recipients: Partial<Record<Role, Address>>
  period: number
  creatorName: string
  platformName: string
}

const percent = (part: bigint, whole: bigint) => (whole === 0n ? 0 : Number((part * 10_000n) / whole) / 100)

const LINE: Record<Role, { label: string; note: (p: CardPlan) => string; who: (p: CardPlan) => string }> = {
  creator: { label: 'Creator line', note: () => 'receives the creator share', who: (p) => p.creatorName },
  platform: { label: 'Platform line', note: () => 'receives the platform cut', who: (p) => p.platformName },
  fee: { label: 'STANDING line', note: (p) => `receives ${percent(p.shares.fee, price(p))}% of the price, out of the platform cut`, who: () => 'STANDING' },
}

function KeyChip({ s }: { s: RoleState }) {
  if (s.status === 'active') return s.scopeOk ? <Chip kind="active">Key active</Chip> : <Chip kind="refused">Scope differs</Chip>
  if (s.status === 'revoked') return <Chip kind="revoked">Revoked</Chip>
  if (s.status === 'expired') return <Chip kind="revoked">Expired</Chip>
  return <Chip kind="wait">No key</Chip>
}

function Readout({ plan, role, s, now }: { plan: CardPlan; role: Role; s: RoleState; now: number }) {
  const bound = s.scope.recipients[0]
  const matches = bound && plan.recipients[role] && isAddressEqual(bound, plan.recipients[role]!)
  const live = s.status === 'active'
  return (
    <div className="readout">
      <div>
        <span className="label">Key</span>
        <KeyChip s={s} />
      </div>
      <div>
        <span className="label">Bound to</span>
        {bound ? (
          <span>
            <Addr address={bound} /> {matches && <span className="muted">matches the plan</span>}
          </span>
        ) : (
          <span className="muted">{s.status === 'revoked' ? 'cleared when revoked' : 'no recipient'}</span>
        )}
      </div>
      <div>
        <span className="label">Left this period</span>
        <span className="mono">{live ? `${money(s.remaining < plan.shares[role] ? s.remaining : plan.shares[role])} of ${money(plan.shares[role])}` : 'none'}</span>
      </div>
      <div>
        <span className="label">Period resets</span>
        <span className="mono">{live && s.periodEnd > 0 ? (s.periodEnd - now > 0 ? `in ${countdown(s.periodEnd - now)}` : 'due now') : 'no further pulls'}</span>
      </div>
    </div>
  )
}

function Wire({ plan, role, state, now }: { plan: CardPlan; role: Role; state?: RoleState; now: number }) {
  const line = LINE[role]
  const total = price(plan)
  const share = plan.shares[role]
  const w = Math.max(percent(share, total), 0.4)
  const spent = state && state.status === 'active' ? Math.min(100, Math.max(0, percent(share - (state.remaining < share ? state.remaining : share), share))) : 0
  const recipient = plan.recipients[role]
  return (
    <section className="wire" aria-label={`${line.label}: ${line.who(plan)} receives at most ${money(share)} per ${periodLabel(plan.period)}`}>
      <div className="g">
        <div className="c-1-3 wire__role">
          <span className="label">{line.label}</span>
          <span className="wire__name">{line.who(plan)}</span>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {line.note(plan)}
          </span>
        </div>
        <div className="c-4-8">
          <div className="track" style={{ ['--w' as string]: `${w}%`, ['--spent' as string]: `${spent}%` }} role="img" aria-label={`cap ${money(share)} of ${money(total)}${state ? `, ${spent.toFixed(0)}% pulled this period` : ''}`}>
            <div className="cap">{state && <div className="cap__spent" />}</div>
          </div>
        </div>
        <div className="c-9-10 amount">
          <span className="big-num">{money(share)}</span>
          <span className="label">cap per {periodLabel(plan.period)}</span>
        </div>
        <div className="c-11-12 seal-cell">
          <span className="seal" aria-hidden="true" />
          <div className="recipient">
            <span className="label">Only to</span>
            {recipient ? <Addr address={recipient} /> : <span className="muted">{role === 'fee' ? 'STANDING treasury' : 'address pending'}</span>}
          </div>
        </div>
        <div className="c-4-12">
          <div className="stubs">
            <span className="stub">
              <span className="stub__elbow" aria-hidden="true" />
              <span className="stub__x" aria-hidden="true" />
              any other address <span className="mono">CallNotAllowed</span>
            </span>
            <span className="stub">
              <span className="stub__elbow" aria-hidden="true" />
              <span className="stub__x" aria-hidden="true" />
              a pull over the cap <span className="mono">SpendingLimitExceeded</span>
            </span>
          </div>
          {state && <Readout plan={plan} role={role} s={state} now={now} />}
        </div>
      </div>
    </section>
  )
}

/** The membership card: the fan's account, three sealed capped lines, and what the chain refuses on each. */
export function MembershipCard({ plan, states, now, account, head }: { plan: CardPlan; states?: Record<Role, RoleState>; now: number; account?: string; head?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="g">
          <div className="c-1-6">
            <div className="who-line">
              <span className="node" aria-hidden="true" />
              <span className="label">{account ? 'Fan account' : 'One fan signature authorises these three capped keys'}</span>
              {account && <span className="mono">{short(account)}</span>}
            </div>
          </div>
          {head && <div className="c-7-12">{head}</div>}
          {states && (
            <div className="span-all legend" aria-label="bar legend">
              <span><i style={{ background: 'var(--color-accent)' }} />cap still available this period</span>
              <span><i style={{ background: 'var(--color-ink)' }} />pulled this period</span>
            </div>
          )}
        </div>
      </div>
      {ROLES.map((r) => (
        <Wire key={r} plan={plan} role={r} state={states?.[r]} now={now} />
      ))}
    </div>
  )
}

export function Refusals() {
  const rows: [string, string, string][] = [
    ['CallNotAllowed', 'A key pays any address other than its own recipient, or calls anything but transferWithMemo.', 'Platform key paying the creator, creator key paying the platform, anyone paying an outsider.'],
    ['SpendingLimitExceeded', 'A key pulls more than its cap inside one period.', 'Platform asking for a bigger cut, or a second pull before the period resets.'],
    ['KeyAlreadyRevoked', 'A key pulls after the member cancelled.', 'The runner on its next tick after one cancel signature.'],
  ]
  return (
    <div className="refusals">
      {rows.map(([name, what, who]) => (
        <div className="refusal" key={name}>
          <span className="mono">{name}</span>
          <div>
            <p>{what}</p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {who}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
