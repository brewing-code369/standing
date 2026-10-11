import { blockUrl } from '../core/chain'
import { periodLabel, type Plan } from '../core/plan'
import type { AttackResult } from './lib/api'
import { dateTime, money, refusalMeaning, short } from './lib/format'
import { Chip, Tx } from './ui'

const KEY: Record<string, 'platform' | 'creator'> = { overcut: 'platform', redirect: 'platform', 'creator-redirect': 'creator', outsider: 'creator' }

/** A refused (or paid) cheat attempt, set as a receipt: who signed, what was asked, the cap, the block, and the chain's answer. */
export function CheatReceipt({ plan, res, at, block, left }: { plan: Plan; res: AttackResult; at: number; block?: string | null; left?: bigint | null }) {
  const role = KEY[res.kind] ?? res.role
  const cap = plan.shares[role]
  const asked = res.kind === 'overcut' ? cap * 2n : cap
  const refused = res.status === 'refused'
  const over = res.kind === 'overcut'
  const blk = block ?? (res as { block?: string }).block ?? null
  return (
    <article className={`receipt ${refused ? 'receipt--refused' : ''}`} aria-live="polite">
      <header className="receipt__head">
        <span className="label">Attempt · {dateTime(at / 1000)}</span>
        <Chip kind={refused ? 'refused' : res.status === 'paid' ? 'paid' : 'wait'}>{refused ? 'Refused by chain' : res.status}</Chip>
      </header>
      <p className="receipt__what">{res.kind === 'overcut' ? (left != null && left === 0n ? `Platform key pulls ${money(asked)} after its ${money(cap)} cap is spent` : `Platform key asks ${money(asked)}, twice its ${money(cap)} cap`) : (res.attempt.charAt(0).toUpperCase() + res.attempt.slice(1)).replace(/0x[0-9a-fA-F]{40}/g, (a) => short(a))}</p>
      <dl className="receipt__rows">
        <dt>Signed by</dt>
        <dd>{role} key on member {short(res.member)}</dd>
        <dt>Asked</dt>
        <dd>{money(asked)} pathUSD</dd>
        <dt>Cap per {periodLabel(plan.period)}</dt>
        <dd>{money(cap)} pathUSD</dd>
        {left != null && (
          <>
            <dt>Left this period (read before the try)</dt>
            <dd className={left < asked ? 'is-refuse' : ''}>{money(left)} pathUSD</dd>
          </>
        )}
        {blk && (
          <>
            <dt>Checked at block</dt>
            <dd>
              <a className="mono" href={blockUrl(blk)} target="_blank" rel="noreferrer">
                {Number(blk).toLocaleString('en-US')}
              </a>
            </dd>
          </>
        )}
      </dl>
      <footer className="receipt__foot">
        {refused && (
          <>
            <span className="receipt__code">{res.reason}</span>
            <span className="muted">{refusalMeaning(res.reason)} Nothing moved. The node rejected the transaction at submission, so it was never mined and has no hash.{blk ? ' The block is when it was checked.' : ''}</span>
          </>
        )}
        {res.status === 'paid' && <Tx hash={res.tx} />}
        {res.status === 'reverted' && <Tx hash={res.tx} />}
        {res.status === 'error' && <span className="muted">{res.message}</span>}
      </footer>
    </article>
  )
}
