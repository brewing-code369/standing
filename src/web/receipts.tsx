import { ROLES, type Role } from '../core/plan'
import type { Renewal } from '../core/ledger'
import { dateTime, money, short } from './lib/format'
import { A, Chip, Tx } from './ui'

const HEAD: Record<Role, string> = { creator: 'Creator', platform: 'Platform', fee: 'STANDING' }

/** Counterfoil rows: one row per member and period, the three pulls under the three wires, each with its tx. */
export function Receipts({ rows, planId, showMember = true }: { rows: Renewal[]; planId: string; showMember?: boolean }) {
  return (
    <div role="table" aria-label="Renewals">
      <div className="rcpt-head" role="row">
        <div className="g">
          <span className="label c-1-3" role="columnheader">
            Period ending
          </span>
          {ROLES.map((r, i) => (
            <span key={r} className={`label ${['c-4-6', 'c-7-9', 'c-10-12'][i]}`} role="columnheader">
              {HEAD[r]}
            </span>
          ))}
        </div>
      </div>
      {rows.map((row) => {
        const n = ROLES.filter((r) => row.pulls[r]).length
        return (
          <div className="rcpt" role="row" key={`${row.member}:${row.periodEnd}`}>
            <div className="g">
              <div className="c-1-3 rcpt__meta" role="cell">
                <span className="mono">{dateTime(row.periodEnd)}</span>
                {showMember && (
                  <A className="mono" href={`/m/${planId}/${row.member}`}>
                    {short(row.member)}
                  </A>
                )}
                <span>{row.complete ? <Chip kind="paid">3 of 3 settled</Chip> : <Chip kind="wait">{n} of 3 settled</Chip>}</span>
              </div>
              {ROLES.map((r, i) => {
                const e = row.pulls[r]
                return (
                  <div key={r} className={`pull ${e ? '' : 'pull--empty'} ${['c-4-6', 'c-7-9', 'c-10-12'][i]}`} role="cell">
                    <span className="label">{HEAD[r]}</span>
                    {e ? (
                      <div className="pull__body">
                        <span className="big-num" style={{ fontSize: 'var(--text-lg)' }}>
                          {money(e.amount)}
                        </span>
                        <Tx hash={e.tx} />
                      </div>
                    ) : (
                      <span className="mono">not pulled</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
