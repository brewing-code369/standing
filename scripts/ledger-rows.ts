import { publicClient } from '../src/core/chain'
import { readLedger, renewals } from '../src/core/ledger'
import { planFromJson } from '../src/core/plan'
const p = planFromJson(await (await fetch('https://standing-tempo.fly.dev/api/plans/c42ee655')).json())
const rows = renewals(await readLedger(publicClient(), p))
for (const r of rows) console.log(r.member.slice(0, 8), r.periodEnd, new Date(r.periodEnd * 1000).toISOString().slice(11, 19), r.complete ? 'complete' : 'INCOMPLETE ' + Object.keys(r.pulls).join('+'), Object.values(r.pulls).map((x) => x!.block).join(','))
