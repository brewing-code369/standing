import { periodLabel, price } from '../../core/plan'
import type { Plan } from '../../core/plan'
import { api, ApiError } from '../lib/api'
import { loadLedger } from '../lib/chainData'
import { money } from '../lib/format'
import { useNow, useResource, type Resource } from '../lib/router'
import { Receipts } from '../receipts'
import { A, Btn, LinkBtn, Notice, Skeleton } from '../ui'
import { MembershipCard } from '../wires'

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

function Ledger({ plan }: { plan: Plan }) {
  const ledger = useResource(() => loadLedger(plan, true), [plan.id])
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
        {ledger.status === 'ready' && ledger.data.renewals.length > 0 && (
          <>
            <Receipts rows={ledger.data.renewals.slice(0, 6)} planId={plan.id} />
            <div className="g" style={{ marginTop: 'var(--space-4)' }}>
              <p className="span-all label">
                {ledger.data.entries.length} pulls in {ledger.data.renewals.length} renewals, read through block {ledger.data.head.toLocaleString('en-US')}
              </p>
            </div>
          </>
        )}
        {ledger.status === 'ready' && ledger.data.renewals.length === 0 && (
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
              <span className="label">Demo plan, read from the chain</span>
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

export function Home() {
  const now = useNow()
  const plan = useResource(() => api.demoPlan(), [])
  const target = plan.status === 'ready' && plan.data ? `/p/${plan.data.id}` : null
  return (
    <>
      <section className="sheet" style={{ paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
        <div className="g">
          <h1 className="display c-1-10">
            three lines.
            <br />
            one signature<span className="period" />
          </h1>
        </div>
        <div className="g" style={{ marginTop: 'var(--space-12)', rowGap: 'var(--space-8)' }}>
          <p className="lede c-1-6">A membership checkout where the platform takes its cut without ever holding the creator's money.</p>
          <div className="c-8-12 stack">
            {target ? (
              <LinkBtn href={target} arrow>
                Join the demo membership
              </LinkBtn>
            ) : (
              <Btn busy={plan.status === 'loading'} disabled={plan.status !== 'loading'} arrow>
                Join the demo membership
              </Btn>
            )}
            <div>
              <A href="/new" className="btn btn--ghost">
                Sell memberships on your platform
              </A>
            </div>
            {plan.status === 'error' && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>The demo opens once the renewal runner answers.</p>}
          </div>
        </div>
      </section>

      <Proof plan={plan} now={now} />

      <section className="plate">
        <div className="sheet band">
          <div className="g" style={{ rowGap: 'var(--space-8)' }}>
            <div className="c-1-6 stack">
              <h2 className="h2">sixty seconds, three pulls.</h2>
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

      {plan.status === 'ready' && plan.data && <Ledger plan={plan.data} />}

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
