import { createPublicClient, http } from 'viem'
import { chain, type PublicClient } from '../src/core/chain'
import { readMembership } from '../src/core/membership'
import { planFromJson } from '../src/core/plan'
const plan = planFromJson(await (await fetch('https://standing-tempo.fly.dev/api/plans/c42ee655')).json())
const member = '0xC18aC8af641A7FeaEe0eCb72972B2b8f79a1F7A6'
for (const [label, opts] of [['batched', { batch: { wait: 25 }, retryCount: 0 }], ['unbatched', { retryCount: 0 }]] as const) {
  const pub = createPublicClient({ chain, transport: http(undefined, opts as never) }) as unknown as PublicClient
  const t = Date.now()
  try { const m = await readMembership(pub, plan, member); console.log(label, 'OK', m.state, Date.now() - t, 'ms') }
  catch (e) { console.log(label, 'FAIL', Date.now() - t, 'ms', ((e as Error).message || '').split('\n').slice(0, 3).join(' | ').slice(0, 300)) }
}
