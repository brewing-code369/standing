import { useEffect, useState } from 'react'
import { periodLabel, price } from '../../core/plan'
import type { Plan } from '../../core/plan'
import { api, ApiError } from '../lib/api'
import { loadLedger, pub } from '../lib/chainData'
import { money } from '../lib/format'
import { useNow, useResource, type Resource } from '../lib/router'
import { Receipts } from '../receipts'
import { A, Btn, LinkBtn, Notice, Skeleton } from '../ui'
import { MembershipCard } from '../wires'
import { CheatReceipt } from '../refusal'
import type { AttackResult } from '../lib/api'

function runnerDown(e: Error) {
  return e instanceof ApiError && e.offline
}

function ProofError({ error, retry, what }: { error: Error; retry: () => void; what: string }) {
  return (
    <Notice tone="error" title={runnerDown(error) ? 'The renewal runner is not answering.' : `${what} did not load.`} action={<Btn variant="ghost" onClick={retry}>Try again</Btn>}>
      {runnerDown(error) ? 'Plans are served by the renewal runner. The chain reads resume as soon as it answers.' : error.message}
    </Notice>
  )
}

type LedgerData = Awaited<ReturnType<typeof loadLedger>>

function Ledger({ plan, ledger }: { plan: Plan; ledger: Resource<LedgerData | null> & { reload: () => void } }) {
  return (
    <section id="ledger" className="sheet band--tight">
      <div className="g">
        <div className="c-1-7 stack">
          <h2 className="h-sec">Latest renewals</h2>
          <p className="muted body">Every row is three transfers on pathUSD, matched to plan {plan.id} by their memo and read from the chain logs. Each hash opens in the explorer.</p>
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-8)' }}>
        {ledger.status === 'loading' && <div className="g"><div className="span-all"><Skeleton label="Reading TransferWithMemo logs from Tempo Moderato" /></div></div>}
        {ledger.status === 'error' && <div className="g"><div className="span-all"><ProofError error={ledger.error} retry={ledger.reload} what="The ledger" /></div></div>}
        {ledger.status === 'ready' && ledger.data && ledger.data.renewals.length > 0 && (
          <>
            <Receipts rows={ledger.data.renewals.slice(0, 6)} planId={plan.id} />
            <div className="g" style={{ marginTop: 'var(--space-4)' }}>
              <p className="span-all label">
                {ledger.data.renewals.filter((r) => r.complete).length} complete renewals, three pulls each, read through block {ledger.data.head.toLocaleString('en-US')}
              </p>
            </div>
          </>
        )}
        {ledger.status === 'ready' && ledger.data && ledger.data.renewals.length === 0 && (
          <div className="g">
            <div className="span-all">
              <Notice title="No renewal has settled on this plan yet." action={<LinkBtn href={`/p/${plan.id}`} arrow>Join the demo membership</LinkBtn>}>
                Join the membership and the runner pulls the first period within seconds. Its three transfers appear here with their hashes.
              </Notice>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Proof({ plan, now }: { plan: Resource<Plan | null> & { reload: () => void }; now: number }) {
  return (
    <section id="proof" className="sheet" style={{ paddingBottom: 'var(--space-4)' }}>
      {plan.status === 'loading' && <div className="g"><div className="span-all"><Skeleton label="Reading the demo plan" /></div></div>}
      {plan.status === 'error' && <div className="g"><div className="span-all"><ProofError error={plan.error} retry={plan.reload} what="The demo plan" /></div></div>}
      {plan.status === 'ready' && plan.data === null && (
        <div className="g">
          <div className="span-all">
            <Notice title="No plan is published yet." action={<LinkBtn href="/new" arrow>Create the first plan</LinkBtn>}>
              Publish a plan and its split, its caps and its renewals appear on this card, read from the chain.
            </Notice>
          </div>
        </div>
      )}
      {plan.status === 'ready' && plan.data && (
        <MembershipCard
          plan={plan.data}
          now={now}
          head={
            <div className="stack" style={{ textAlign: 'left' }}>
              <h2 className="h3">{plan.data.name.split(', renews')[0]}</h2>
              <p>
                <span className="big-num">{money(price(plan.data))}</span> <span className="muted">pathUSD per renewal · plan {plan.data.id}</span>
              </p>
            </div>
          }
        />
      )}
    </section>
  )
}

function LiveProof({ plan, ledger, now }: { plan: Plan; ledger: Resource<LedgerData | null>; now: number }) {
  const health = useResource(() => api.health(), [])
  useEffect(() => {
    const id = setInterval(health.reload, 15000)
    return () => clearInterval(id)
  }, [health.reload])
  const [cheat, setCheat] = useState<{ busy: boolean; res?: AttackResult; at?: number; block?: string | null; error?: string }>({ busy: false })
  const data = ledger.status === 'ready' ? ledger.data : null
  const complete = data ? data.renewals.filter((r) => r.complete).length : null
  const member = data?.renewals[0]?.member
  const tickAgo = health.status === 'ready' && health.data.lastTick ? Math.max(0, Math.round(now - health.data.lastTick.at / 1000)) : null
  const tryCheat = async () => {
    if (!member) return
    setCheat({ busy: true })
    try {
      const res = await api.attack(plan.id, member, 'overcut')
      const block = (res as { block?: string }).block ?? (await pub.getBlockNumber().then(String).catch(() => null))
      setCheat({ busy: false, res, at: Date.now(), block })
    } catch (e) {
      setCheat({ busy: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return (
    <div className="stack">
      <span className="label">Live on Tempo Moderato · plan <span className="mono">{plan.id}</span> · runner ticked {tickAgo === null ? '…' : `${tickAgo}s ago`}</span>
      <div className="proof-row">
        <span className="proof-num">{complete === null ? <span className="ph" aria-label="reading" /> : complete.toLocaleString('en-US')}</span>
        <span className="h3">complete renewals{complete !== null && <>, <span className="proof-zero">each pull inside its cap</span></>}</span>
      </div>
      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        {complete === null ? 'Reading TransferWithMemo logs from Moderato.' : `${(complete * 3).toLocaleString('en-US')} capped pulls settled, read through block ${data!.head.toLocaleString('en-US')}. Every hash is in the ledger below.`}
      </p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <Btn variant="ghost" busy={cheat.busy} disabled={!member || cheat.busy} onClick={tryCheat}>Make the platform take double its cut</Btn>
      </div>
      {cheat.res && <CheatReceipt plan={plan} res={cheat.res} at={cheat.at!} block={cheat.block} />}
      {cheat.error && <p className="field__err" role="alert">{cheat.error}</p>}
    </div>
  )
}

export function Home() {
  const now = useNow()
  const plan = useResource(() => api.demoPlan(), [])
  const planData = plan.status === 'ready' ? plan.data : null
  const ledger = useResource(() => (planData ? loadLedger(planData, true) : Promise.resolve(null)), [planData?.id ?? null])
  useEffect(() => {
    if (!planData) return
    const id = setInterval(ledger.reload, 60000)
    return () => clearInterval(id)
  }, [planData, ledger.reload])
  const target = plan.status === 'ready' && plan.data ? `/p/${plan.data.id}` : null
  return (
    <>
      <section className="sheet" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div className="g" style={{ alignItems: 'start', rowGap: 'var(--space-6)' }}>
          <div className="c-1-7">{planData ? <LiveProof plan={planData} ledger={ledger} now={now} /> : plan.status === 'error' ? null : <Skeleton label="Reading the demo plan" />}</div>
          <div className="c-8-12 stack">
            <h1 className="h2">Three capped keys. One fan signature.</h1>
            <p className="body">A membership checkout where the platform takes its cut without ever holding the creator&apos;s money. Each key can pay only its own recipient, only up to its cap, once per period.</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {target ? (
                <LinkBtn href={target} arrow>
                  Join the demo membership
                </LinkBtn>
              ) : (
                <Btn busy={plan.status === 'loading'} disabled={plan.status !== 'loading'} arrow>
                  Join the demo membership
                </Btn>
              )}
            </div>
          </div>
        </div>
      </section>

      <Proof plan={plan} now={now} />


      {planData && <Ledger plan={planData} ledger={ledger} />}

    </>
  )
}
