// Creates the demo plans through the live API and subscribes demo fans from Node, exactly as the checkout page does.
// Keys go to keys/seed.json (chmod 600, gitignored). Prints the demo fan addresses for the server's DEMO_FANS env.
import fs from 'node:fs'
import { createClient, http, publicActions, walletActions, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { Account } from 'viem/tempo'
import { chain, FEE_TOKEN, PATH_USD, publicClient, txUrl } from '../src/core/chain'
import { checkoutCalls } from '../src/core/calls'
import { readMembership } from '../src/core/membership'
import { planFromJson, toUnits, type Plan } from '../src/core/plan'

const API = process.env.API ?? 'http://localhost:8787'
const pub = publicClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const
const bal = (t: Address, a: Address) => pub.readContract({ address: t, abi: erc20, functionName: 'balanceOf', args: [a] })

const keyFile = 'keys/seed.json'
const K: Record<string, Hex> = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')) : {}
for (const n of ['CREATOR', 'PLATFORM', 'FAN_1', 'FAN_2', 'FAN_3', 'FAN_4']) K[n] ??= generatePrivateKey()
fs.mkdirSync('keys', { recursive: true, mode: 0o700 })
fs.writeFileSync(keyFile, JSON.stringify(K), { mode: 0o600 })

async function api<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  const r = await fetch(API + path, init ? { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) } : undefined)
  const j = await r.json()
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`)
  return j as T
}

async function fund(a: Address) {
  if ((await bal(PATH_USD, a)) >= toUnits('50') && (await bal(FEE_TOKEN, a)) >= toUnits('1')) return
  await createClient({ chain, transport: http() }).request({ method: 'tempo_fundAddress', params: [a] } as never)
  for (let i = 0; ; i++) {
    if ((await bal(PATH_USD, a)) >= toUnits('50') && (await bal(FEE_TOKEN, a)) >= toUnits('1')) return
    if (i === 60) throw new Error(`faucet did not fund ${a}`)
    await sleep(1000)
  }
}

const creator = privateKeyToAddress(K.CREATOR)
const platform = privateKeyToAddress(K.PLATFORM)
const existing = (await api<Parameters<typeof planFromJson>[0][]>('/api/plans')).map(planFromJson)
const ensure = async (name: string, price: string, period: number): Promise<Plan> =>
  existing.find((p) => p.name === name && p.recipients.creator === creator) ??
  planFromJson(await api('/api/plans', { method: 'POST', body: { name, creatorName: 'Demo creator wallet', platformName: 'Demo platform wallet', creator, platform, price, platformBps: 2000, period } }))

const demo = await ensure('Demo membership, renews every 5 minutes', '1.00', 300)
const monthly = await ensure('Monthly membership', '10.00', 2_592_000)
console.log(JSON.stringify({ plans: [demo.id, monthly.id], creator, platform }))

const subs: [Plan, string][] = [[demo, 'FAN_1'], [demo, 'FAN_2'], [demo, 'FAN_3'], [monthly, 'FAN_4']]
for (const [p, fan] of subs) {
  const acct = Account.fromSecp256k1(K[fan])
  const before = await readMembership(pub, p, acct.address)
  if (before.state === 'active') { console.log(JSON.stringify({ fan, plan: p.id, state: 'already active' })); continue }
  await fund(acct.address)
  const c = createClient({ account: acct, chain, transport: http() }).extend(publicActions).extend(walletActions)
  const tx = await c.sendTransaction({ calls: checkoutCalls(p) } as never)
  const rx = await pub.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  const run = await api<{ results: { role: string; status: string; tx?: string }[] }>('/api/run', { method: 'POST', body: { plan: p.id, member: acct.address } })
  const after = await readMembership(pub, p, acct.address)
  console.log(JSON.stringify({ fan, plan: p.id, member: acct.address, checkout: rx.status, url: txUrl(tx), pulls: run.results.map((r) => `${r.role}:${r.status}`), state: after.state }))
}
console.log(`DEMO_FANS=${subs.map(([, f]) => privateKeyToAddress(K[f])).join(',')}`)
