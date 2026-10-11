import { useMemo, useState, type FormEvent } from 'react'
import { isAddress, isAddressEqual, type Address } from 'viem'
import { DEFAULT_FEE_BPS, split, toUnits, type Plan } from '../../core/plan'
import { api, ApiError } from '../lib/api'
import { money } from '../lib/format'
import { useNow } from '../lib/router'
import { A, Btn, Copy, LinkBtn, Notice } from '../ui'
import { MembershipCard } from '../wires'

const PERIODS = [
  { seconds: 120, label: '2 minutes (demo)' },
  { seconds: 86_400, label: '1 day' },
  { seconds: 2_592_000, label: '1 month' },
]

type Form = { name: string; creatorName: string; platformName: string; creator: string; platform: string; price: string; cut: string; period: number }
const EMPTY: Form = { name: '', creatorName: '', platformName: '', creator: '', platform: '', price: '10.00', cut: '20', period: 120 }

function check(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.name.trim()) e.name = 'Name the membership.'
  if (!f.creatorName.trim()) e.creatorName = 'Name the creator.'
  if (!f.platformName.trim()) e.platformName = 'Name your platform.'
  if (!isAddress(f.creator)) e.creator = 'Paste the creator wallet address, 0x followed by 40 hex characters.'
  if (!isAddress(f.platform)) e.platform = 'Paste the platform wallet address, 0x followed by 40 hex characters.'
  if (!e.creator && !e.platform && isAddressEqual(f.creator as Address, f.platform as Address)) e.platform = 'The platform and the creator need different addresses.'
  if (!/^\d{1,5}(\.\d{1,6})?$/.test(f.price) || Number(f.price) < 0.01) e.price = 'Enter a price such as 10.00, at least 0.01.'
  const cut = Number(f.cut)
  if (!Number.isFinite(cut) || cut <= 1 || cut > 90) e.cut = 'The platform cut is above 1% and at most 90%, because 1% of the price goes to STANDING out of it.'
  return e
}

export function NewPlan() {
  const now = useNow(60_000)
  const [f, setF] = useState<Form>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<Plan | null>(null)
  const errors = useMemo(() => check(f), [f])

  const shares = useMemo(() => {
    if (errors.price || errors.cut) return null
    try {
      return split(toUnits(f.price), Math.round(Number(f.cut) * 100), DEFAULT_FEE_BPS)
    } catch {
      return null
    }
  }, [f.price, f.cut, errors.price, errors.cut])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: k === 'period' ? Number(e.target.value) : e.target.value }))

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setTouched(true)
    setError(null)
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      setMade(await api.createPlan({ name: f.name.trim(), creatorName: f.creatorName.trim(), platformName: f.platformName.trim(), creator: f.creator as Address, platform: f.platform as Address, price: f.price, platformBps: Math.round(Number(f.cut) * 100), period: f.period }))
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? 'The renewal runner is not answering, so the plan was not created. Try again in a moment.' : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const show = (k: keyof Form) => (touched ? errors[k] : undefined)
  const link = made ? `${location.origin}/p/${made.id}` : ''

  const cardPlan = {
    shares: shares ?? { creator: 0n, platform: 0n, fee: 0n },
    recipients: { creator: isAddress(f.creator) ? (f.creator as Address) : undefined, platform: isAddress(f.platform) ? (f.platform as Address) : undefined },
    period: f.period,
    creatorName: f.creatorName.trim() || 'Creator',
    platformName: f.platformName.trim() || 'Your platform',
  }

  if (made) {
    return (
      <div className="sheet band" style={{ paddingTop: 'var(--space-12)' }}>
        <div className="g" style={{ rowGap: 'var(--space-8)' }}>
          <div className="c-1-10 stack">
            <span className="label">Plan {made.id} is live</span>
            <h1 className="display" style={{ fontSize: 'clamp(44px, 8vw, 104px)' }}>Share the link</h1>
          </div>
          <div className="c-1-7 stack">
            <p className="lede">Members who open it sign once. Their money stays in their account until each key pulls its own share.</p>
            <div className="share">
              <span className="mono">{link}</span>
              <Copy text={link} label="Copy link" />
            </div>
            <div className="row">
              <LinkBtn href={`/p/${made.id}`} arrow>
                Open the checkout
              </LinkBtn>
              <Btn variant="ghost" onClick={() => { setMade(null); setF(EMPTY); setTouched(false) }}>Create another plan</Btn>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-12)' }}>
          <MembershipCard plan={made} now={now} />
        </div>
      </div>
    )
  }

  return (
    <div className="sheet band" style={{ paddingTop: 'var(--space-12)' }}>
      <div className="g" style={{ rowGap: 'var(--space-12)' }}>
        <div className="c-1-6 stack-lg">
          <div className="stack">
            <span className="label">For platform operators</span>
            <h1 className="title">Sell memberships</h1>
            <p className="lede">Set the price and your cut. The checkout link that comes back moves each share straight from the member to its owner.</p>
          </div>
          <form onSubmit={submit} noValidate className="stack-lg" aria-label="Create a plan">
            <div className="stack">
              <label className="field">
                <span className="label">Membership name</span>
                <input value={f.name} onChange={set('name')} placeholder="Studio pass" maxLength={60} aria-invalid={!!show('name')} autoComplete="off" />
                {show('name') && <span className="field__err">{show('name')}</span>}
              </label>
              <div className="pair">
                <label className="field">
                  <span className="label">Creator name</span>
                  <input value={f.creatorName} onChange={set('creatorName')} maxLength={40} aria-invalid={!!show('creatorName')} autoComplete="off" />
                  {show('creatorName') && <span className="field__err">{show('creatorName')}</span>}
                </label>
                <label className="field">
                  <span className="label">Your platform name</span>
                  <input value={f.platformName} onChange={set('platformName')} maxLength={40} aria-invalid={!!show('platformName')} autoComplete="off" />
                  {show('platformName') && <span className="field__err">{show('platformName')}</span>}
                </label>
              </div>
              <label className="field">
                <span className="label">Creator wallet</span>
                <input className="mono-input" value={f.creator} onChange={set('creator')} placeholder="0x" spellCheck={false} aria-invalid={!!show('creator')} autoComplete="off" />
                {show('creator') && <span className="field__err">{show('creator')}</span>}
              </label>
              <label className="field">
                <span className="label">Platform wallet</span>
                <input className="mono-input" value={f.platform} onChange={set('platform')} placeholder="0x" spellCheck={false} aria-invalid={!!show('platform')} autoComplete="off" />
                {show('platform') && <span className="field__err">{show('platform')}</span>}
              </label>
              <div className="pair">
                <label className="field">
                  <span className="label">Price in pathUSD</span>
                  <input inputMode="decimal" value={f.price} onChange={set('price')} aria-invalid={!!show('price')} autoComplete="off" />
                  {show('price') && <span className="field__err">{show('price')}</span>}
                </label>
                <label className="field">
                  <span className="label">Platform cut %</span>
                  <input inputMode="decimal" value={f.cut} onChange={set('cut')} aria-invalid={!!show('cut')} autoComplete="off" />
                  {show('cut') && <span className="field__err">{show('cut')}</span>}
                </label>
              </div>
              <label className="field">
                <span className="label">Renews every</span>
                <select value={f.period} onChange={set('period')}>
                  {PERIODS.map((p) => (
                    <option key={p.seconds} value={p.seconds}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <Notice tone="error" title="The plan was not created.">
                {error}
              </Notice>
            )}
            <div className="row">
              <Btn type="submit" busy={busy} arrow>
                {busy ? 'Creating the plan' : 'Create the plan'}
              </Btn>
              <A href="/" className="top-link">
                See a live card first
              </A>
            </div>
          </form>
        </div>

        <div className="c-7-12 sticky stack">
          <span className="label">Live split</span>
          {shares ? (
            <MembershipCard plan={cardPlan} now={now} />
          ) : (
            <Notice title="The split appears here.">Enter a price and a platform cut. The creator share, your cut and the 1% STANDING fee are computed as you type, to the sixth decimal.</Notice>
          )}
          {shares && (
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Creator {money(shares.creator)}, platform {money(shares.platform)}, STANDING {money(shares.fee)} pathUSD. The 1% STANDING fee comes out of the platform cut, so the creator share stays exactly as priced. The chain caps each key at exactly its number.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
