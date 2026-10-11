import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getAddress, isAddressEqual, type Address } from 'viem'
import { cancelCalls } from '../../core/calls'
import type { Membership } from '../../core/membership'
import { periodLabel, type Plan, type Role } from '../../core/plan'
import { api, ApiError, type AttackKind, type AttackResult } from '../lib/api'
import { loadLedger, loadMembership, pub } from '../lib/chainData'
import { countdown, dateTime, money, plainError, short } from '../lib/format'
import { useNow, useResource } from '../lib/router'
import { sendCalls } from '../lib/wallet'
import { Receipts } from '../receipts'
import { A, Btn, Chip, LinkBtn, Notice, Skeleton, Tx } from '../ui'
import { useWallet } from '../wallet-context'
import { MembershipCard, type TryLine } from '../wires'
import { CheatReceipt } from '../refusal'

const HEAD: Partial<Record<Membership['state'], string>> = { active: 'Active', cancelled: 'Cancelled', none: 'Ready to join' }

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

  const [tryBusy, setTryBusy] = useState<string | null>(null)
  const [tryRes, setTryRes] = useState<{ role: Role; kind: AttackKind; node: ReactNode; reason?: string } | null>(null)
  const runTry = async (kind: AttackKind, role: Role, key: string = kind) => {
    if (!plan) return
    setTryBusy(key)
    const at = Date.now()
    try {
      const res = await api.attack(plan.id, member, kind)
      const block = (res as { block?: string }).block ?? (await pub.getBlockNumber().then(String).catch(() => null))
      setTryRes({ role, kind, node: <CheatReceipt plan={plan} res={res} at={at} block={block} />, reason: res.status === 'refused' ? res.reason : undefined })
    } catch (e) {
      setTryRes({ role, kind, node: <p className="field__err" role="alert">{e instanceof ApiError && e.offline ? 'The renewal runner is not answering, so no attempt was made.' : e instanceof Error ? e.message : String(e)}</p> })
    } finally {
      setTryBusy(null)
    }
  }
  const TRY: Record<string, AttackKind> = { 'platform:SpendingLimitExceeded': 'overcut', 'platform:CallNotAllowed': 'redirect', 'creator:CallNotAllowed': 'creator-redirect' }
  const tryLine: TryLine = {
    can: (role, code) => !!TRY[`${role}:${code}`] && mem?.state === 'active',
    go: (role, code) => void runTry(TRY[`${role}:${code}`], role, `${role}:${code}`),
    busy: tryBusy,
    result: tryRes && tryRes.kind !== 'outsider' ? { role: tryRes.role, node: tryRes.node } : null,
  }
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
            <h1 className="title">No such plan</h1>
            <Notice tone="error" title={planR.error instanceof ApiError && planR.error.offline ? 'The renewal runner is not answering.' : `Plan ${planId} is not published.`} action={<Btn variant="ghost" onClick={planR.reload}>Try again</Btn>}>
              The membership page reads the plan from the renewal runner and the keys from the chain.
            </Notice>
          </div>
        </div>
      </div>
    )

  const p = planR.data
  const headWord = mem ? (HEAD[mem.state] ?? 'Keys in progress') : 'Reading'
  const periodEnd = mem && mem.state === 'active' ? mem.roles.creator.periodEnd : 0
  const paid = ledger.status === 'ready' && ledger.data ? ledger.data.renewals.flatMap((r) => Object.values(r.pulls)).reduce((s, e) => s + (e?.amount ?? 0n), 0n) : null

  return (
    <>
      <div className="sheet band" style={{ paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-8)' }}>
      <div className="stack-lg">
        <div className="g" style={{ rowGap: 'var(--space-6)', alignItems: 'end' }}>
          <div className="c-1-5 stack">
            <span className="label">
              Membership on plan <A href={`/p/${p.id}`}>{p.id}</A> · <span className="mono">{short(member)}</span>
            </span>
            {mem ? <h1 className="title">{headWord}</h1> : memError ? <h1 className="h2">{memError}</h1> : <Skeleton label="Reading the three keys on this account from Moderato" />}
 {memError && mem && <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>Last key read failed, showing the previous read; retrying every 10 s.</p>}
            <p className="muted">
              {p.name.split(', renews')[0]} · {money(p.shares.creator + p.shares.platform + p.shares.fee)} pathUSD per renewal
            </p>
          </div>
          <div className="c-6-12 inline-stats" aria-live="off">
            <span><b>{ledger.status === 'ready' && ledger.data ? ledger.data.renewals.filter((r) => r.complete).length.toLocaleString('en-US') : <span className="ph" />}</b> <span className="muted">renewals</span></span>
            <span><b>{paid === null ? <span className="ph" /> : money(paid)}</b> <span className="muted">pathUSD pulled, within caps</span></span>
            <span><b className="countdown">{mem?.state === 'active' ? (periodEnd - now > 0 ? countdown(periodEnd - now) : 'due, runner next tick') : mem ? 'none' : <span className="ph" />}</b> <span className="muted">until the period ends</span></span>
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

        {memError && !mem && (
          <div className="g">
            <div className="span-all">
              <Notice tone="error" title="The keychain read failed." action={<Btn variant="ghost" onClick={() => void readMem()}>Read again</Btn>}>
                {memError}
              </Notice>
            </div>
          </div>
        )}

        <div className="g">
          <div className="span-all row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h2 className="h-sec">Three keys on this account</h2>
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Four refusals on this card can be tried live. <b>Try it</b> has the runner sign that cheat with its real key; the chain answers.</span>
          </div>
        </div>
        <MembershipCard
          plan={p}
          now={now}
          account={member}
          states={mem && mem.state !== 'none' ? mem.roles : undefined}
          t={tryLine}
          foot={
            <div className="g" style={{ borderTop: '1px solid var(--color-rule)', paddingBlock: 'var(--space-3)' }}>
              <div className="span-all row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
                <span className="stub"><span className="stub__elbow" aria-hidden="true" /><span className="stub__x" aria-hidden="true" />a stranger's account
                <span className="mono" style={{ color: 'var(--color-refuse)', fontSize: 'var(--text-sm)' }}>{tryRes?.kind === 'outsider' && tryRes.reason ? tryRes.reason : 'KeyNotFound'}</span></span>
                <button type="button" className="btn btn--ghost btn--xs" disabled={tryBusy !== null} onClick={() => void runTry('outsider', 'creator')}>{tryBusy === 'outsider' ? 'Asking the chain…' : 'Try it'}</button>
              </div>
              {tryRes?.kind === 'outsider' && <div className="span-all" style={{ marginTop: 'var(--space-3)' }}>{tryRes.node}</div>}
            </div>
          }
        />


        <section className="stack" aria-labelledby="hist">
          <div className="g">
            <div className="c-1-7 stack">
              <h2 className="h-sec" id="hist">Renewal history</h2>
            </div>
          </div>
          {ledger.status === 'loading' && <div className="g"><div className="span-all"><Skeleton label="Reading this member's pulls from the chain logs" /></div></div>}
          {ledger.status === 'error' && <div className="g"><div className="span-all"><Notice tone="error" title="The ledger did not load." action={<Btn variant="ghost" onClick={ledger.reload}>Try again</Btn>}>{ledger.error.message}</Notice></div></div>}
          {ledger.status === 'ready' && ledger.data && ledger.data.renewals.length > 0 && <><Receipts rows={ledger.data.renewals.slice(0, 6)} planId={p.id} showMember={false} />{ledger.data.renewals.length > 6 && <p className="label" style={{ paddingInline: 'var(--pad)' }}>Latest 6 of {ledger.data.renewals.length} renewals for this member · every hash opens in the explorer</p>}</>}
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


      <div className="sheet band--tight" style={{ borderTop: '1px solid var(--color-rule)' }}>
        <section className="stack" aria-labelledby="cancel">
          <div className="g" style={{ rowGap: 'var(--space-6)' }}>
            <div className="c-1-6 stack">
              <h2 className="h-sec" id="cancel">Cancel</h2>
              <p className="muted body">One signature revokes the creator, platform and STANDING keys in a single transaction. The next pull is refused with <span className="mono" style={{ color: 'var(--color-refuse)' }}>KeyAlreadyRevoked</span>.</p>
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
