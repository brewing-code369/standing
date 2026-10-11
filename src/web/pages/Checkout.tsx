import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { checkoutCalls } from '../../core/calls'
import type { Membership } from '../../core/membership'
import { periodLabel, price, ROLES, type Plan, type Role } from '../../core/plan'
import { api, ApiError, type PullResultJson } from '../lib/api'
import { isAddressEqual } from 'viem'
import { loadLedger, loadMembership } from '../lib/chainData'
import { money } from '../lib/format'
import { useNow, useResource } from '../lib/router'
import { balances, fund, sendCalls } from '../lib/wallet'
import { A, Btn, Chip, LinkBtn, Notice, Skeleton, Tx } from '../ui'
import { useWallet } from '../wallet-context'
import { MembershipCard, Refusals } from '../wires'

type Bal = { pathUsd: bigint; fee: bigint }
type Sub =
  | { phase: 'idle' }
  | { phase: 'signing' }
  | { phase: 'confirming' }
  | { phase: 'pulling'; tx: string }
  | { phase: 'done'; tx: string; results: PullResultJson[] }
  | { phase: 'error'; message: string; tx?: string }

const ROLE_NAME: Record<Role, string> = { creator: 'Creator', platform: 'Platform', fee: 'STANDING' }
const GAS_NEED = 1_000_000n

function PullRows({ results, pending }: { results: PullResultJson[]; pending: boolean }) {
  return (
    <div>
      {ROLES.map((r) => {
        const x = results.find((q) => q.role === r)
        let chip = <Chip kind="wait">{pending ? 'Pulling' : 'Not due'}</Chip>
        let detail: ReactNode = null
        if (x?.status === 'paid') {
          chip = <Chip kind="paid">Paid {money(BigInt(x.amount))}</Chip>
          detail = <Tx hash={x.tx} />
        } else if (x?.status === 'refused') {
          chip = <Chip kind="refused">Refused</Chip>
          detail = <span className="mono">{x.reason}</span>
        } else if (x?.status === 'skipped') {
          chip = <Chip kind="wait">Skipped</Chip>
          detail = <span className="muted">{x.reason}</span>
        } else if (x?.status === 'reverted') {
          chip = <Chip kind="refused">Reverted</Chip>
          detail = <Tx hash={x.tx} />
        } else if (x?.status === 'error') {
          chip = <Chip kind="refused">Error</Chip>
          detail = <span className="muted">{x.message}</span>
        }
        return (
          <div key={r} className="verdict" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <span className="label">{ROLE_NAME[r]} pull</span>
            <span>{chip}</span>
            <span style={{ gridColumn: '1 / -1' }}>{detail}</span>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ plan }: { plan: Plan }) {
  const { wallet, busy, error, connect, freshBrowserKey } = useWallet()
  const total = price(plan)
  const [bal, setBal] = useState<Bal | null>(null)
  const [fundState, setFundState] = useState<{ phase: 'idle' | 'busy' | 'error'; message?: string }>({ phase: 'idle' })
  const [sub, setSub] = useState<Sub>({ phase: 'idle' })
  const [mem, setMem] = useState<Membership | null>(null)
  const [memError, setMemError] = useState<string | null>(null)

  const address = wallet?.address
  const readMem = useCallback(async () => {
    if (!address) return null
    try {
      const m = await loadMembership(plan, address)
      setMem(m)
      setMemError(null)
      return m
    } catch (e) {
      setMemError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [plan, address])

  useEffect(() => {
    setBal(null)
    setMem(null)
    setSub({ phase: 'idle' })
    if (!address) return
    balances(address).then(setBal, () => setBal(null))
    void readMem()
  }, [address, readMem])

  const funded = !!bal && bal.pathUsd >= total && bal.fee >= GAS_NEED
  const holds = mem?.state === 'active'

  const doFund = async () => {
    if (!address) return
    setFundState({ phase: 'busy' })
    try {
      setBal(await fund(address, total, setBal))
      setFundState({ phase: 'idle' })
    } catch (e) {
      setFundState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const pull = async (tx: string) => {
    if (!address) return
    setSub({ phase: 'pulling', tx })
    try {
      const { results } = await api.run(plan.id, address)
      const m = await readMem()
      setSub({ phase: 'done', tx, results: await settle(results, m) })
    } catch (e) {
      setSub({ phase: 'error', tx, message: e instanceof ApiError && e.offline ? 'The first pull is waiting on the renewal runner. Your keys are installed.' : e instanceof Error ? e.message : String(e) })
    }
  }

  /** The chain is the record: a role whose pull is on the ledger for the current period is paid, whatever the runner's reply said. */
  const settle = async (results: PullResultJson[], m: Membership | null): Promise<PullResultJson[]> => {
    if (!address || !m) return results
    let out = results
    for (let attempt = 0; attempt < 2; attempt++) {
      const led = await loadLedger(plan, true).catch(() => null)
      if (led) {
        out = ROLES.map((role) => {
          const e = led.entries.find((x) => x.role === role && isAddressEqual(x.member, address) && x.periodEnd === m.roles[role].periodEnd)
          return e ? ({ role, member: address, status: 'paid', tx: e.tx, amount: e.amount.toString(), periodEnd: e.periodEnd } as PullResultJson) : results.find((r) => r.role === role)
        }).filter((r): r is PullResultJson => !!r)
        if (out.every((r) => r.status === 'paid') && out.length === ROLES.length) break
      }
      await new Promise((r) => setTimeout(r, 2500))
    }
    return out
  }

  const doSubscribe = async () => {
    if (!wallet) return
    setSub({ phase: 'signing' })
    try {
      const { tx } = await sendCalls(wallet, checkoutCalls(plan))
      setSub({ phase: 'confirming' })
      await readMem()
      await pull(tx)
    } catch (e) {
      setSub({ phase: 'error', message: e instanceof Error ? e.message.split('\n')[0].slice(0, 240) : String(e) })
    }
  }

  const keyState = wallet ? 'done' : 'active'
  const fundDone = funded
  const fundStateAttr = !wallet ? 'locked' : fundDone ? 'done' : 'active'
  const subStateAttr = !wallet || !funded ? 'locked' : sub.phase === 'done' || holds ? 'done' : 'active'
  const cancelled = mem?.state === 'cancelled'

  return (
    <div className="panel">
      <div className="panel__head">
        <span className="label">Checkout</span>
        <span className="mono">
          {money(total)} / {periodLabel(plan.period)}
        </span>
      </div>

      <div className="step" data-state={keyState}>
        <div className="step__head">
          <div className="who-line">
            <span className="step__mark" aria-hidden="true" />
            <h3 className="h3">Choose the key that signs</h3>
          </div>
          {wallet && <Chip kind="active">{wallet.kind === 'browser' ? 'Browser key' : 'Passkey'}</Chip>}
        </div>
        <div className="pair">
          <Btn variant="ghost" selected={wallet?.kind === 'browser'} busy={busy === 'browser'} onClick={() => connect('browser')}>
            Use a browser key
          </Btn>
          <Btn variant="ghost" selected={wallet?.kind === 'passkey'} busy={busy === 'passkey'} onClick={() => connect('passkey')}>
            Use a passkey
          </Btn>
        </div>
        {error && <p className="field__err" role="alert">{error}</p>}
        {wallet ? (
          <p className="mono" style={{ overflowWrap: 'anywhere' }}>
            {wallet.address}
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            The browser key is a P256 key created on this device and kept non-extractable. It becomes the account that pays.
          </p>
        )}
      </div>

      <div className="step" data-state={fundStateAttr}>
        <div className="step__head">
          <div className="who-line">
            <span className="step__mark" aria-hidden="true" />
            <h3 className="h3">Fund the account</h3>
          </div>
          {wallet && bal && <Chip kind={funded ? 'ok' : 'wait'}>{funded ? 'Funded' : 'Needs funds'}</Chip>}
        </div>
        <dl className="kv">
          <dt>pathUSD</dt>
          <dd className="mono">{bal ? money(bal.pathUsd) : wallet ? 'reading' : 'no account yet'}</dd>
          <dt>Gas balance</dt>
          <dd className="mono">{bal ? money(bal.fee) : wallet ? 'reading' : 'no account yet'}</dd>
        </dl>
        <Btn variant="ghost" disabled={!wallet || funded} busy={fundState.phase === 'busy'} onClick={doFund}>
          {funded ? 'Account funded' : fundState.phase === 'busy' ? 'Waiting for the faucet' : 'Fund from the Moderato faucet'}
        </Btn>
        {fundState.phase === 'error' && (
          <Notice tone="error" title="The faucet did not fund this key." action={<Btn variant="ghost" size="sm" onClick={doFund}>Ask the faucet again</Btn>}>
            {fundState.message}
          </Notice>
        )}
      </div>

      <div className="step" data-state={subStateAttr}>
        <div className="step__head">
          <div className="who-line">
            <span className="step__mark" aria-hidden="true" />
            <h3 className="h3">Subscribe</h3>
          </div>
          {holds && <Chip kind="active">Membership active</Chip>}
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          One transaction, three authorizeKey calls. Each key is bound to one recipient and one cap. The runner sponsors the gas of every renewal.
        </p>
        <Btn
          disabled={!wallet || !funded || holds || cancelled || sub.phase === 'pulling' || sub.phase === 'confirming'}
          busy={sub.phase === 'signing'}
          onClick={doSubscribe}
          arrow
        >
          {sub.phase === 'signing' ? 'Waiting for the signature' : holds ? 'Membership active' : 'Subscribe with one signature'}
        </Btn>
        {cancelled && (
          <Notice title="This key cancelled the membership." action={<Btn variant="ghost" size="sm" onClick={freshBrowserKey}>Create a fresh browser key</Btn>}>
            The three pull keys were revoked on this account and the chain does not reinstate them. A new key subscribes again.
          </Notice>
        )}
        {memError && <p className="field__err">The keychain read failed: {memError}</p>}
      </div>

      {(sub.phase !== 'idle' || holds) && (
        <div className="step" data-state="active" aria-live="polite">
          {'tx' in sub && sub.tx && (
            <div className="verdict" data-ok="true">
              <span className="label">Checkout transaction</span>
              <Tx hash={sub.tx} />
            </div>
          )}
          {(sub.phase === 'confirming' || sub.phase === 'signing') && <Skeleton label={sub.phase === 'signing' ? 'Signing and sending the transaction' : 'Reading the keychain from the chain'} />}
          {(sub.phase === 'pulling' || sub.phase === 'done') && (
            <>
              <h3 className="h3">{sub.phase === 'pulling' ? 'The runner is pulling the first period' : 'First period pulled'}</h3>
              <PullRows results={sub.phase === 'done' ? sub.results : []} pending={sub.phase === 'pulling'} />
            </>
          )}
          {sub.phase === 'error' && (
            <Notice
              tone="error"
              title={sub.tx ? 'The keys are installed. The first pull is waiting.' : 'The checkout did not go through.'}
              action={sub.tx ? <Btn variant="ghost" size="sm" onClick={() => pull(sub.tx!)}>Run the pulls again</Btn> : <Btn variant="ghost" size="sm" onClick={doSubscribe}>Try again</Btn>}
            >
              {sub.message}
            </Notice>
          )}
          {mem && mem.state !== 'none' && address && (
            <div className="stack">
              <div className="row">
                <span className="label">Membership read from the chain</span>
                <Chip kind={mem.state === 'active' ? 'active' : mem.state === 'cancelled' ? 'revoked' : 'wait'}>{mem.state}</Chip>
              </div>
              <LinkBtn href={`/m/${plan.id}/${address}`} arrow>
                Open the membership
              </LinkBtn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Checkout({ planId }: { planId: string }) {
  const planR = useResource(() => api.plan(planId), [planId])
  const now = useNow()
  const { wallet } = useWallet()
  const [mem, setMem] = useState<Membership | null>(null)
  const loaded = planR.status === 'ready' ? planR.data : null
  const owner = wallet?.address
  useEffect(() => {
    setMem(null)
    if (!loaded || !owner) return
    let live = true
    const read = () => loadMembership(loaded, owner).then((m) => live && setMem(m), () => undefined)
    void read()
    const id = setInterval(read, 8000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [loaded, owner])

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
  if (planR.status === 'error') {
    const missing = !(planR.error instanceof ApiError && planR.error.offline)
    return (
      <div className="sheet band">
        <div className="g">
          <div className="c-1-7 stack">
            <h1 className="title">{missing ? 'no such plan.' : 'runner offline.'}</h1>
            <Notice tone="error" title={missing ? `Plan ${planId} is not published.` : 'The renewal runner is not answering.'} action={<><Btn variant="ghost" onClick={planR.reload}>Try again</Btn><A href="/" className="btn btn--ghost">Back to the card</A></>}>
              {missing ? 'Check the link with the platform that sent it, or create the plan yourself.' : 'The plan is held by the runner. Try again in a moment.'}
            </Notice>
          </div>
        </div>
      </div>
    )
  }
  const plan = planR.data
  return (
    <div className="sheet band" style={{ paddingTop: 'var(--space-12)' }}>
      <div className="g" style={{ rowGap: 'var(--space-12)' }}>
        <div className="c-1-7 stack-lg">
          <div className="stack">
            <span className="label">
              Checkout, plan {plan.id}
            </span>
            <h1 className="title">{plan.name}</h1>
            <p className="lede">
              {plan.creatorName} on {plan.platformName}. <span className="big-num" style={{ fontSize: 'inherit' }}>{money(price(plan))}</span> pathUSD every {periodLabel(plan.period)}.
            </p>
          </div>
          <MembershipCard plan={plan} now={now} states={mem && mem.state !== 'none' ? mem.roles : undefined} account={wallet?.address} />
          <div className="stack">
            <h2 className="h2">what the chain refuses.</h2>
            <p className="muted body">Each line is enforced by the account keychain, not by this site or the runner. These are the answers it gives.</p>
            <Refusals />
          </div>
        </div>
        <div className="c-8-12 sticky">
          <Panel plan={plan} />
        </div>
      </div>
    </div>
  )
}
