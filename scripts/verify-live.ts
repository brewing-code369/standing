// Fails unless the deployed runner is renewing memberships: reads every plan from the live API, then the ledger
// from chain logs. Pass = runner ticked in the last 2 minutes without error AND some member of a period <= 1h plan has
// >= MIN_RENEWALS complete renewals (creator, platform and fee all paid for the same period).
import { publicClient, txUrl } from '../src/core/chain'
import { readLedger, renewals } from '../src/core/ledger'
import { planFromJson, usd } from '../src/core/plan'

const API = process.env.API ?? 'https://standing-tempo.fly.dev'
const MIN_RENEWALS = Number(process.env.MIN_RENEWALS ?? 2)
const pub = publicClient()

const health = (await (await fetch(`${API}/api/health`)).json()) as { lastTick: { at: number; error?: string } | null }
const plans = ((await (await fetch(`${API}/api/plans`)).json()) as Parameters<typeof planFromJson>[0][]).map(planFromJson)
const tickAge = health.lastTick ? (Date.now() - health.lastTick.at) / 1000 : Infinity
console.log(JSON.stringify({ api: API, plans: plans.length, tickAgeSeconds: Math.round(tickAge), tickError: health.lastTick?.error ?? null }))

let best = 0
for (const p of plans) {
  const entries = await readLedger(pub, p)
  const rows = renewals(entries)
  const perMember = new Map<string, number>()
  for (const r of rows) if (r.complete) perMember.set(r.member, (perMember.get(r.member) ?? 0) + 1)
  const top = Math.max(0, ...perMember.values())
  if (p.period <= 3600) best = Math.max(best, top)
  console.log(JSON.stringify({ plan: p.id, name: p.name, period: p.period, price: usd(p.shares.creator + p.shares.platform + p.shares.fee), pulls: entries.length, completeRenewals: rows.filter((r) => r.complete).length, members: perMember.size, maxRenewalsOneMember: top, latest: rows[0] ? txUrl(rows[0].pulls.creator?.tx ?? '') : null }))
}
const ok = tickAge < 120 && !health.lastTick?.error && best >= MIN_RENEWALS
console.log(JSON.stringify({ verdict: ok ? 'PASS' : 'FAIL', bestRenewalsOneMember: best, need: MIN_RENEWALS }))
process.exit(ok ? 0 : 1)
