import { useState } from 'react'
import { periodLabel, price } from '../../core/plan'
import type { Plan } from '../../core/plan'
import { api, ApiError } from '../lib/api'
import { loadLedger } from '../lib/chainData'
import { money } from '../lib/format'
import { useNow, useResource, type Resource } from '../lib/router'
import { Receipts } from '../receipts'
import { A, Btn, LinkBtn, Notice, Skeleton } from '../ui'
import { MembershipCard } from '../wires'
import { Cheat } from './Member'

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
    <section id="ledger" className="sheet band ruled-top">
      <div className="g">
        <div className="c-1-7 stack">
          <h2 className="h2">latest renewals.</h2>
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
            <div className="g" style={{ marginTop: 'var(--space-12)' }}>
              <div className="span-all stack">
                <h2 className="h2">try to cheat a live member.</h2>
                <p className="muted body">The runner holds the real platform and creator keys for this plan. Ask them to take a bigger cut, pay someone else, or pull from a stranger, and read the chain&apos;s answer.</p>
                <Cheat plan={plan} member={ledger.data.renewals[0].member} />
              </div>
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
    <section id="proof" className="sheet" style={{ paddingBottom: 'var(--space-16)' }}>
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
              <span className="label">Demo plan · renewals read from the chain</span>
              <h2 className="h3">{plan.data.name}</h2>
              <p>
                <span className="big-num">{money(price(plan.data))}</span> <span className="muted">pathUSD every {periodLabel(plan.data.period)}, plan {plan.data.id}</span>
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
  const [cheat, setCheat] = useState<{ busy: boolean; text?: string; refused?: boolean }>({ busy: false })
  const data = ledger.status === 'ready' ? ledger.data : null
  const complete = data ? data.renewals.filter((r) => r.complete).length : null
  const member = data?.renewals[0]?.member
  const tickAgo = health.status === 'ready' && health.data.lastTick ? Math.max(0, Math.round(now - health.data.lastTick.at / 1000)) : null
  const tryCheat = async () => {
    if (!member) return
    setCheat({ busy: true })
    try {
      const r = await api.attack(plan.id, member, 'overcut')
      setCheat({ busy: false, refused: r.status === 'refused', text: r.status === 'refused' ? `${r.reason}: ${r.attempt}` : `${r.status}: ${r.attempt}` })
    } catch (e) {
      setCheat({ busy: false, text: e instanceof Error ? e.message : String(e) })
    }
  }
  return (
    <div className="live" aria-live="polite">
      <span className="label">Live on Tempo Moderato · plan {plan.id}</span>
      <div className="live__nums">
        <div><div className="live__n">{complete ?? '…'}</div><span className="label">complete renewals</span></div>
        <div><div className="live__n">{complete === null ? '…' : (complete * 3).toLocaleString('en-US')}</div><span className="label">pulls settled</span></div>
        <div><div className="live__n mono" style={{ fontSize: 'var(--text-lg)' }}>{data ? data.head.toLocaleString('en-US') : '…'}</div><span className="label">read through block</span></div>
        <div><div className="live__n mono" style={{ fontSize: 'var(--text-lg)' }}>{tickAgo === null ? '…' : `${tickAgo}s ago`}</div><span className="label">runner last tick</span></div>
      </div>
      <div className="live__try">
        <Btn variant="ghost" busy={cheat.busy} disabled={!member || cheat.busy} onClick={tryCheat}>Take double the cut</Btn>
        {cheat.text && <p className="mono" style={{ fontSize: 'var(--text-sm)', color: cheat.refused ? 'var(--color-refuse)' : undefined }}>{cheat.refused ? 'Refused by the chain · ' : ''}{cheat.text}</p>}
      </div>
    </div>
  )
}

export function Home() {
  const now = useNow()
  const plan = useResource(() => api.demoPlan(), [])
  const planData = plan.status === 'ready' ? plan.data : null
  const ledger = useResource(() => (planData ? loadLedger(planData, true) : Promise.resolve(null)), [planData?.id ?? null])
  const target = plan.status === 'ready' && plan.data ? `/p/${plan.data.id}` : null
  return (
    <>
      <section className="sheet" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div className="g" style={{ alignItems: 'start', rowGap: 'var(--space-6)' }}>
          <div className="c-1-7 stack">
            <h1 className="display" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}>
              three lines.
              <br />
              one signature<span className="period" />
            </h1>
            <p className="lede">A membership checkout where the platform takes its cut without ever holding the creator's money.</p>
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
              <A href="/new" className="btn btn--ghost">
                Sell memberships on your platform
              </A>
            </div>
            {plan.status === 'error' && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>The demo opens once the renewal runner answers.</p>}
          </div>
          <div className="c-8-12">{planData ? <LiveProof plan={planData} ledger={ledger} now={now} /> : <Skeleton label="Reading the demo plan" />}</div>
        </div>
      </section>

      <Proof plan={plan} now={now} />

      <section className="plate">
        <div className="sheet band">
          <div className="g" style={{ rowGap: 'var(--space-8)' }}>
            <div className="c-1-6 stack">
              <h2 className="h2">one signature, three pulls.</h2>
              <p className="lede">Join the demo and watch the renewal runner pull creator, platform and fee, each hash on the explorer.</p>
            </div>
            <div className="c-7-12 stack-lg">
              <div className="plate-steps">
                <div className="plate-step">A browser key is created on this device and stays in it.</div>
                <div className="plate-step">The Moderato faucet funds it with test money.</div>
                <div className="plate-step">One signature installs the three capped keys.</div>
                <div className="plate-step">The chain answers every pull, and every attempt to cheat.</div>
              </div>
              {target && (
                <LinkBtn href={target} arrow>
                  Join the demo membership
                </LinkBtn>
              )}
            </div>
          </div>
        </div>
      </section>

      {planData && <Ledger plan={planData} ledger={ledger} />}

      <section className="sheet band ruled-top">
        <div className="g" style={{ rowGap: 'var(--space-8)' }}>
          <div className="c-1-7 stack">
            <h2 className="h2">you run a platform.</h2>
            <p className="body">Set the price, your cut and the period. STANDING returns a checkout link where your members sign once and every share moves from their account to its owner, never through yours.</p>
          </div>
          <div className="c-8-12">
            <LinkBtn href="/new" arrow>
              Sell memberships on your platform
            </LinkBtn>
          </div>
        </div>
      </section>
    </>
  )
}
