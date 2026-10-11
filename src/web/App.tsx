import { useEffect, useState } from 'react'
import { api, type RunnerInfo } from './lib/api'
import { short } from './lib/format'
import { matchRoute, usePath } from './lib/router'
import { Home } from './pages/Home'
import { Member } from './pages/Member'
import { NewPlan } from './pages/NewPlan'
import { Checkout } from './pages/Checkout'
import { A, Notice, Rails } from './ui'
import { WalletProvider, useWallet } from './wallet-context'

function RunnerStatus() {
  const [info, setInfo] = useState<RunnerInfo | null | 'down'>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    let live = true
    let fails = 0
    const load = () =>
      api.runner().then(
        (r) => { fails = 0; if (live) setInfo(r) },
        () => { fails++; if (live) setInfo((prev) => (fails >= 3 ? 'down' : prev)) },
      )
    load()
    const poll = setInterval(load, 15_000)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      live = false
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [])
  if (info === null) return <span className="muted"><span className="dot" /> Reading the renewal runner</span>
  if (info === 'down') return <span><span className="dot dot--down" /> Renewal runner not answering</span>
  const t = info.lastTick
  if (!t) return <span><span className="dot" /> Renewal runner starting</span>
  const ago = Math.max(0, Math.round((now - t.at) / 1000))
  const fresh = ago < (info.tickMs / 1000) * 3 + 30
  return (
    <span>
      <span className={`dot ${fresh ? 'dot--ok' : 'dot--warn'}`} /> Renewal runner {fresh ? 'ticked' : 'last ticked'} {ago}s ago
    </span>
  )
}

function Top({ route }: { route: ReturnType<typeof matchRoute> }) {
  const { wallet } = useWallet()
  return (
    <header className="top">
      <div className="sheet">
        <div className="g">
          <div className="c-1-3">
            <A className="brand" href="/" aria-label="standing, home">
              standing<span className="period" />
            </A>
          </div>
          <nav className="c-4-8 top-row" aria-label="Main">
            <A className="top-link" href="/#ledger">
              Live ledger
            </A>
            <A className="top-link" href="/new" aria-current={route.name === 'new' ? 'page' : undefined}>
              Sell memberships
            </A>
          </nav>
          <div className="c-9-12 top-status">
            <span className="label">Moderato</span>
            {wallet && (
              <A className="chip chip--active" href="/" title={wallet.address} style={{ textDecoration: 'none' }}>
                Key {short(wallet.address, 6, 4)}
              </A>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function Foot() {
  return (
    <footer className="foot">
      <div className="sheet">
        <div className="g">
          <div className="c-1-3">
            <span className="brand">
              standing<span className="period" />
            </span>
          </div>
          <p className="c-4-8 muted">The platform takes its cut. The chain holds every cap, every recipient and every cancel.</p>
          <div className="c-9-12 stack" style={{ fontSize: 'var(--text-sm)' }}>
            <div>
              <RunnerStatus />
            </div>
            <div className="row">
              <a href="https://explore.testnet.tempo.xyz" target="_blank" rel="noreferrer">
                Tempo explorer
              </a>
              <A href="/new">Create a plan</A>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function Page() {
  const route = matchRoute(usePath())
  useEffect(() => {
    document.title = route.name === 'home' ? 'STANDING: memberships the chain caps' : `STANDING: ${route.name === 'new' ? 'create a plan' : route.name === 'plan' ? 'checkout' : route.name === 'member' ? 'membership' : 'not found'}`
  }, [route.name])
  return (
    <div className="page">
      <Rails />
      <Top route={route} />
      <main id="main" style={{ position: 'relative', zIndex: 1 }}>
        {route.name === 'home' && <Home />}
        {route.name === 'new' && <NewPlan />}
        {route.name === 'plan' && <Checkout key={route.planId} planId={route.planId} />}
        {route.name === 'member' && <Member key={`${route.planId}:${route.account}`} planId={route.planId} account={route.account} />}
        {route.name === 'missing' && (
          <div className="sheet band">
            <div className="g">
              <div className="c-1-7 stack">
                <h1 className="title">Nothing here</h1>
                <Notice title={`Nothing lives at ${route.path}`} action={<A className="btn" href="/">Back to the card</A>}>
                  Checkout links look like /p/ followed by an 8 character plan id. Membership pages look like /m/ plan id / account.
                </Notice>
              </div>
            </div>
          </div>
        )}
      </main>
      <Foot />
    </div>
  )
}

export const App = () => (
  <WalletProvider>
    <Page />
  </WalletProvider>
)
