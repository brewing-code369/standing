import { useCallback, useEffect, useState } from 'react'
import { getAddress, isAddressEqual, type Address } from 'viem'
import { cancelCalls } from '../../core/calls'
import type { Membership } from '../../core/membership'
import { periodLabel, type Plan } from '../../core/plan'
import { api, ApiError, type AttackKind, type AttackResult } from '../lib/api'
import { loadLedger, loadMembership } from '../lib/chainData'
import { countdown, dateTime, money, plainError, short } from '../lib/format'
import { useNow, useResource } from '../lib/router'
import { sendCalls } from '../lib/wallet'
import { Receipts } from '../receipts'
import { A, Btn, Chip, LinkBtn, Notice, Skeleton, Tx } from '../ui'
import { useWallet } from '../wallet-context'
import { MembershipCard } from '../wires'
import { CheatReceipt } from '../refusal'

const ATTACKS: { kind: AttackKind; title: string; sub: string }[] = [
  { kind: 'overcut', title: 'Take more than the cut', sub: 'Platform key asks for double its cap' },
  { kind: 'redirect', title: 'Send the cut elsewhere', sub: 'Platform key pays another address' },
  { kind: 'creator-redirect', title: 'Divert the creator share', sub: 'Creator key pays the platform' },
  { kind: 'outsider', title: 'Pull from a stranger', sub: 'Creator key on an account that never subscribed' },
]

const HEAD: Partial<Record<Membership['state'], string>> = { active: 'active.', cancelled: 'cancelled.', none: 'ready to join.' }

type Attempt = { id: number; kind: AttackKind; at: number; res?: AttackResult; error?: string }

function Verdict({ a, plan }: { a: Attempt; plan: Plan }) {
  if (a.error) {
    return (
      <div className="verdict">
        <span className="label">{dateTime(a.at / 1000)}</span>
        <p className="field__err">{a.error}</p>
      </div>
    )
  }
  return <CheatReceipt plan={plan} res={a.res!} at={a.at} />
}

export function Cheat({ plan, member }: { plan: Plan; member: Address }) {
  const [log, setLog] = useState<Attempt[]>([])
  const [busy, setBusy] = useState<AttackKind | null>(null)
  const go = async (kind: AttackKind) => {
    setBusy(kind)
    const id = Date.now()
    try {
      const res = await api.attack(plan.id, member, kind)
      setLog((l) => [{ id, kind, at: id, res }, ...l])
    } catch (e) {
      setLog((l) => [{ id, kind, at: id, error: e instanceof ApiError && e.offline ? 'The renewal runner is not answering, so no attempt was made.' : e instanceof Error ? e.message : String(e) }, ...l])
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="stack-lg">
      <div className="cheat">
        {ATTACKS.map((a) => (
          <Btn key={a.kind} variant="ghost" className="cheat__btn" busy={busy === a.kind} disabled={busy !== null && busy !== a.kind} onClick={() => go(a.kind)}>
            {a.title}
            <small>{a.sub}</small>
          </Btn>
        ))}
      </div>
      {log.length === 0 ? (
        <p className="muted body">Press one. The runner signs the attempt with its real key, sends it to Tempo Moderato and reports the revert name the chain returns.</p>
      ) : (
        <div className="receipts-log">
          {log.map((a) => (
            <Verdict key={a.id} a={a} plan={plan} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Member({ planId, account }: { planId: string; account: string }) {
  const member = getAddress(account)
  const planR = useResource(() => api.plan(planId), [planId])
  const plan = planR.status === 'ready' ? planR.data : null
  const now = useNow()
  const { wallet, connect, error: walletError } = useWallet()

  const [mem, setMem] = useState<Membership | null>(null)
  const [memError, setMemError] = useState<string | null>(null)
  const readMem = useCallback(async () => {
    if (!plan) return null
    try {
      const m = await loadMembership(plan, member)
      setMem(m)
      setMemError(null)
      return m
    } catch (e) {
      setMemError(plainError(e))
      return null
    }
  }, [plan, member])
  useEffect(() => {
    void readMem()
    const id = setInterval(readMem, 10000)
    return () => clearInterval(id)
  }, [readMem])

  const ledger = useResource(() => (plan ? loadLedger(plan).then((l) => ({ ...l, renewals: l.renewals.filter((r) => isAddressEqual(r.member, member)) })) : Promise.resolve(null)), [plan?.id, member])
  useEffect(() => {
    if (!plan) return
    const id = setInterval(ledger.reload, 20000)
    return () => clearInterval(id)
  }, [plan, ledger.reload])

  const [confirming, setConfirming] = useState(false)
  const [cancel, setCancel] = useState<{ phase: 'idle' | 'signing' | 'done' | 'error'; tx?: string; message?: string }>({ phase: 'idle' })
  const mine = !!wallet && isAddressEqual(wallet.address, member)

  const doCancel = async () => {
    if (!plan || !wallet) return
    setCancel({ phase: 'signing' })
    try {
      const { tx } = await sendCalls(wallet, cancelCalls(plan))
      await readMem()
      ledger.reload()
      setConfirming(false)
      setCancel({ phase: 'done', tx })
    } catch (e) {
      setCancel({ phase: 'error', message: plainError(e) })
    }
  }

  if (planR.status === 'loading')
    return (
      <div className="sheet band">
        <div className="g">
          <div className="span-all">
            <Skeleton label={`Reading plan ${planId}`} />
          </div>
        </div>
      </div>
    )
  if (planR.status === 'error')
    return (
      <div className="sheet band">
        <div className="g">
          <div className="c-1-7 stack">
            <h1 className="title">no such plan.</h1>
            <Notice tone="error" title={planR.error instanceof ApiError && planR.error.offline ? 'The renewal runner is not answering.' : `Plan ${planId} is not published.`} action={<Btn variant="ghost" onClick={planR.reload}>Try again</Btn>}>
              The membership page reads the plan from the renewal runner and the keys from the chain.
            </Notice>
          </div>
        </div>
      </div>
    )

  const p = planR.data
  const headWord = mem ? (HEAD[mem.state] ?? 'keys in progress.') : 'reading.'
  const periodEnd = mem && mem.state === 'active' ? mem.roles.creator.periodEnd : 0
  const paid = ledger.status === 'ready' && ledger.data ? ledger.data.renewals.flatMap((r) => Object.values(r.pulls)).reduce((s, e) => s + (e?.amount ?? 0n), 0n) : null

  return (
    <>
      <div className="sheet band" style={{ paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-16)' }}>
      <div className="stack-lg">
        <div className="g" style={{ rowGap: 'var(--space-6)', alignItems: 'end' }}>
          <div className="c-1-5 stack">
            <span className="label">
              Membership on plan <A href={`/p/${p.id}`}>{p.id}</A> · <span className="mono">{short(member)}</span>
            </span>
            {mem ? <h1 className="title">{headWord}</h1> : memError ? <h1 className="h2">{memError}</h1> : <Skeleton label="Reading the three keys on this account from Moderato" />}
            <p className="muted">
              {p.name}. {money(p.shares.creator + p.shares.platform + p.shares.fee)} pathUSD every {periodLabel(p.period)}.
            </p>
          </div>
          <div className="c-6-12 member-stats">
            <div>
              <span className="label">Renewals settled</span>
              <p className="big-num" style={{ fontSize: 'var(--text-2xl)' }}>{ledger.status === 'ready' && ledger.data ? ledger.data.renewals.filter((r) => r.complete).length.toLocaleString('en-US') : '…'}</p>
            </div>
            <div>
              <span className="label">Pulled so far</span>
              <p className="big-num" style={{ fontSize: 'var(--text-2xl)' }}>{paid === null ? '…' : money(paid)}</p>
              <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>pathUSD, within caps</span>
            </div>
            <div>
              <span className="label">Next renewal</span>
              <p className="big-num" style={{ fontSize: 'var(--text-2xl)' }} aria-live="off">
                {mem?.state === 'active' ? (periodEnd - now > 0 ? `in ${countdown(periodEnd - now)}` : 'due now') : mem ? 'none' : '…'}
              </p>
              {mem?.state === 'active' && <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>at {dateTime(periodEnd)}</span>}
            </div>
          </div>
          {mem?.state === 'cancelled' && <p className="span-all muted">All three keys are revoked. The chain refuses every further pull.</p>}
          {mem?.state === 'none' && (
            <div className="span-all">
              <LinkBtn href={`/p/${p.id}`} arrow>
                Subscribe to this plan
              </LinkBtn>
            </div>
          )}
        </div>

        {memError && (
          <div className="g">
            <div className="span-all">
              <Notice tone="error" title="The keychain read failed." action={<Btn variant="ghost" onClick={() => void readMem()}>Read again</Btn>}>
                {memError}
              </Notice>
            </div>
          </div>
        )}

        <MembershipCard plan={p} now={now} account={member} states={mem && mem.state !== 'none' ? mem.roles : undefined} />

        <section className="stack" aria-labelledby="hist">
          <div className="g">
            <div className="c-1-7 stack">
              <h2 className="h2" id="hist">Renewal history</h2>
            </div>
          </div>
          {ledger.status === 'loading' && <div className="g"><div className="span-all"><Skeleton label="Reading this member's pulls from the chain logs" /></div></div>}
          {ledger.status === 'error' && <div className="g"><div className="span-all"><Notice tone="error" title="The ledger did not load." action={<Btn variant="ghost" onClick={ledger.reload}>Try again</Btn>}>{ledger.error.message}</Notice></div></div>}
          {ledger.status === 'ready' && ledger.data && ledger.data.renewals.length > 0 && <Receipts rows={ledger.data.renewals} planId={p.id} showMember={false} />}
          {ledger.status === 'ready' && ledger.data && ledger.data.renewals.length === 0 && (
            <div className="g">
              <div className="span-all">
                <Notice title="No pull has settled for this account yet." action={mem?.state === 'none' ? <LinkBtn href={`/p/${p.id}`}>Subscribe to this plan</LinkBtn> : undefined}>
                  {mem?.state === 'active' ? 'The runner pulls the first period right after checkout and again at each reset. Its three transfers land here with their hashes.' : 'Once this account subscribes, the runner pulls each period and every transfer lands here with its hash.'}
                </Notice>
              </div>
            </div>
          )}
        </section>

      </div>
      </div>

      <section className="plate" aria-labelledby="cheat">
          <div className="sheet band">
            <div className="g" style={{ rowGap: 'var(--space-8)' }}>
              <div className="c-1-6 stack">
                <h2 className="h2" id="cheat">Try to cheat this member</h2>
                <p className="lede">The runner holds only these three keys. Ask it to break its own rules.</p>
              </div>
              <div className="c-7-12" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-ink)', padding: 'var(--space-6)' }}>
                <Cheat plan={p} member={member} />
              </div>
            </div>
          </div>
      </section>

      <div className="sheet band">
        <section className="stack" aria-labelledby="cancel">
          <div className="g" style={{ rowGap: 'var(--space-6)' }}>
            <div className="c-1-6 stack">
              <h2 className="h2" id="cancel">Cancel</h2>
              <p className="muted body">One signature revokes the creator, platform and STANDING keys in a single transaction. The next pull is refused with KeyAlreadyRevoked.</p>
            </div>
            <div className="c-8-12 stack">
              {mem?.state === 'cancelled' || cancel.phase === 'done' ? (
                <div className="stack">
                  <Chip kind="revoked">{mem?.state ?? 'cancelled'}</Chip>
                  {cancel.tx && (
                    <div className="verdict" data-ok="true">
                      <span className="label">Cancel transaction</span>
                      <Tx hash={cancel.tx} />
                    </div>
                  )}
                </div>
              ) : !mem ? (
                <p className="muted">{memError ?? 'Reading the three keys on this account from Moderato.'}</p>
              ) : mem.state === 'none' ? (
                <p className="muted">There is nothing to cancel on this account.</p>
              ) : mine ? (
                confirming ? (
                  <div className="stack">
                    <p>Revoke all three keys now? Pulls stop at once.</p>
                    <div className="row">
                      <Btn variant="danger" busy={cancel.phase === 'signing'} onClick={doCancel}>
                        Sign: revoke three keys
                      </Btn>
                      <Btn variant="ghost" onClick={() => setConfirming(false)} disabled={cancel.phase === 'signing'}>
                        Keep the membership
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <Btn variant="danger" onClick={() => setConfirming(true)}>
                    Cancel membership
                  </Btn>
                )
              ) : (
                <div className="stack">
                  <Chip kind="wait">Owner only</Chip>
                  <p>Only this member&apos;s key can cancel: one signature revokes all three keys. You are viewing as a visitor.</p>
                  <Btn variant="ghost" onClick={() => connect('browser')}>
                    Use my browser key
                  </Btn>
                  {wallet && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>The connected key is a different account.</p>}
                  {walletError && <p className="field__err" role="alert">{walletError}</p>}
                </div>
              )}
              {cancel.phase === 'error' && <p className="field__err" role="alert">{cancel.message}</p>}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
