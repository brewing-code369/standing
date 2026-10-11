// Live end-to-end run on Tempo Moderato. Every assertion reads chain state; nothing is mocked.
// Fresh accounts per run; private keys go to keys/e2e-<ts>.json (chmod 600, gitignored) and are never printed.
import fs from 'node:fs'
import { createClient, http, publicActions, walletActions, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { Account, WebCryptoP256 } from 'viem/tempo'
import { chain, FEE_TOKEN, PATH_USD, publicClient, txUrl } from '../src/core/chain'
import { cancelCalls, checkoutCalls } from '../src/core/calls'
import { discoverMembers, readMembership, readRole } from '../src/core/membership'
import { readLedger, renewals } from '../src/core/ledger'
import { pull, type PullResult } from '../src/core/pull'
import { ROLES, split, toUnits, usd, validatePlan, type Plan, type Role } from '../src/core/plan'

const PERIOD = Number(process.env.PERIOD ?? 60)
const ts = new Date().toISOString().replace(/[:.]/g, '-')
fs.mkdirSync('evidence', { recursive: true })
fs.mkdirSync('keys', { recursive: true, mode: 0o700 })
const logPath = `evidence/e2e-${ts}.jsonl`
const rec = (o: Record<string, unknown>) => {
  const line = JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pub = publicClient()
const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const
const bal = (t: Address, a: Address) => pub.readContract({ address: t, abi: erc20, functionName: 'balanceOf', args: [a] })

const K: Record<string, Hex> = {}
for (const n of ['FAN_A', 'CREATOR', 'PLATFORM', 'STANDING', 'CREATOR_KEY', 'PLATFORM_KEY', 'FEE_KEY', 'SPONSOR', 'OUTSIDER']) K[n] = generatePrivateKey()
fs.writeFileSync(`keys/e2e-${ts}.json`, JSON.stringify(K), { mode: 0o600 })
const A = (n: string) => privateKeyToAddress(K[n])

const fanA = Account.fromSecp256k1(K.FAN_A)
const fanB = Account.fromWebCryptoP256(await WebCryptoP256.createKeyPair())
const sponsor = A('SPONSOR')

async function fund(addr: Address) {
  await createClient({ chain, transport: http() }).request({ method: 'tempo_fundAddress', params: [addr] } as never)
  for (let i = 0; ; i++) {
    if ((await bal(PATH_USD, addr)) >= toUnits('50') && (await bal(FEE_TOKEN, addr)) >= toUnits('1')) return
    if (i === 60) throw new Error(`faucet did not fund ${addr} within 60s`)
    await sleep(1000)
  }
}
await Promise.all([fund(fanA.address), fund(fanB.address), fund(sponsor)])

const head = await pub.getBlockNumber()
const shares = split(toUnits('10'), 2000, 100)
const plan: Plan = validatePlan({
  id: Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, '0'),
  name: 'e2e membership',
  creatorName: 'e2e creator',
  platformName: 'e2e platform',
  recipients: { creator: A('CREATOR'), platform: A('PLATFORM'), fee: A('STANDING') },
  shares,
  keys: { creator: A('CREATOR_KEY'), platform: A('PLATFORM_KEY'), fee: A('FEE_KEY') },
  period: PERIOD,
  createdBlock: head,
  createdAt: Math.floor(Date.now() / 1000),
})
const pullKey: Record<Role, Hex> = { creator: K.CREATOR_KEY, platform: K.PLATFORM_KEY, fee: K.FEE_KEY }
const snap = async () => ({
  fanA: await bal(PATH_USD, fanA.address), fanB: await bal(PATH_USD, fanB.address),
  fanAfee: await bal(FEE_TOKEN, fanA.address), fanBfee: await bal(FEE_TOKEN, fanB.address),
  creator: await bal(PATH_USD, plan.recipients.creator), platform: await bal(PATH_USD, plan.recipients.platform), fee: await bal(PATH_USD, plan.recipients.fee),
})
rec({ step: 'conditions', chainId: chain.id, head, period: PERIOD, plan: plan.id, shares: { creator: usd(shares.creator), platform: usd(shares.platform), fee: usd(shares.fee) }, fanA: fanA.address, fanB_p256: fanB.address, recipients: plan.recipients, keys: plan.keys, sponsor })

async function rootSend(label: string, account: typeof fanA | typeof fanB, calls: { to: Address; data: Hex }[]) {
  const c = createClient({ account, chain, transport: http() }).extend(publicActions).extend(walletActions)
  const tx = await c.sendTransaction({ calls } as never)
  const r = await pub.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  rec({ step: label, result: r.status, tx, url: txUrl(tx), gasUsed: r.gasUsed, calls: calls.length })
  if (r.status !== 'success') throw new Error(`${label} reverted`)
  return r
}

// 1. checkout: one signature per fan installs all three keys.
await rootSend('checkout fan A (secp256k1 root): 3 authorizeKey in one tx', fanA, checkoutCalls(plan))
await rootSend('checkout fan B (WebCrypto P256 root): 3 authorizeKey in one tx', fanB, checkoutCalls(plan))

const b0 = await snap()
const mA = await readMembership(pub, plan, fanA.address)
const mB = await readMembership(pub, plan, fanB.address)
rec({ step: 'membership after checkout', A: mA.state, B: mB.state, A_roles: ROLES.map((r) => ({ r, status: mA.roles[r].status, scopeOk: mA.roles[r].scopeOk, remaining: usd(mA.roles[r].remaining), periodEnd: mA.roles[r].periodEnd, recipients: mA.roles[r].scope.recipients })) })

const members = await discoverMembers(pub, plan, plan.createdBlock, await pub.getBlockNumber())
rec({ step: 'discovered members from KeyAuthorized logs', members })

const doPull = async (label: string, member: Address, role: Role, extra: { amount?: bigint; to?: Address } = {}): Promise<PullResult> => {
  const st = await readRole(pub, plan, member, role)
  const r = await pull({ plan, role, member, pullKey: pullKey[role], sponsor: K.SPONSOR, periodEnd: st.periodEnd, ...extra })
  rec({ step: label, ...r, ...('tx' in r ? { url: txUrl(r.tx) } : {}) })
  return r
}

// 2. period 1: runner pulls each share for both fans, gas paid by the sponsor.
const p1: PullResult[] = []
for (const m of [fanA.address, fanB.address]) for (const r of ROLES) p1.push(await doPull(`P1 ${r} pull for ${m === fanA.address ? 'A' : 'B'}`, m, r))
const b1 = await snap()

// 3. what the chain must refuse.
const n = {
  overCut: await doPull('NEG platform pulls again in the same period', fanA.address, 'platform'),
  redirect: await doPull('NEG platform key pays the creator address', fanA.address, 'platform', { to: plan.recipients.creator, amount: toUnits('1') }),
  feeRedirect: await doPull('NEG fee key pays the platform address', fanA.address, 'fee', { to: plan.recipients.platform, amount: toUnits('0.05') }),
  creatorOver: await doPull('NEG creator pulls 0.01 more in the same period', fanA.address, 'creator', { amount: toUnits('0.01') }),
  nonMember: await doPull('NEG creator key pulls from an account that never subscribed', A('OUTSIDER'), 'creator'),
}
const afterP1 = await readMembership(pub, plan, fanA.address)
rec({ step: 'fan A limits after P1', roles: ROLES.map((r) => ({ r, remaining: usd(afterP1.roles[r].remaining), periodEnd: afterP1.roles[r].periodEnd })) })

// 4. wait for the period to roll (bounded), renew fan A.
const target = Math.max(...ROLES.map((r) => afterP1.roles[r].periodEnd))
for (let i = 0; ; i++) {
  const now = Number((await pub.getBlock()).timestamp)
  if (now > target) break
  if (i === PERIOD + 60) throw new Error('period did not roll in time')
  await sleep(1000)
}
const p2: PullResult[] = []
for (const r of ROLES) p2.push(await doPull(`P2 ${r} renewal for A`, fanA.address, r))

// 5. cancel: one signature revokes all three keys; the next pull is refused.
await rootSend('fan A cancels: 3 revokeKey in one tx', fanA, cancelCalls(plan))
const afterCancel = await doPull('NEG creator pulls after cancel', fanA.address, 'creator')
const mA2 = await readMembership(pub, plan, fanA.address)
rec({ step: 'membership after cancel', A: mA2.state, roles: ROLES.map((r) => mA2.roles[r].status) })

// 6. ledger read back from chain logs.
const ledger = await readLedger(pub, plan)
const rows = renewals(ledger)
rec({ step: 'ledger', entries: ledger.length, renewals: rows.map((x) => ({ member: x.member, periodEnd: x.periodEnd, complete: x.complete })) })

const b2 = await snap()
const d = { fanA: b2.fanA - b0.fanA, fanB: b2.fanB - b0.fanB, creator: b2.creator - b0.creator, platform: b2.platform - b0.platform, fee: b2.fee - b0.fee, fanAfeeDuringPulls: b1.fanAfee - b0.fanAfee, fanBfeeDuringPulls: b1.fanBfee - b0.fanBfee }
rec({ step: 'deltas (6dp)', ...d })

const checks: Record<string, boolean> = {
  checkoutActiveA: mA.state === 'active',
  checkoutActiveB_p256: mB.state === 'active',
  discoveredBoth: members.length === 2 && members.includes(fanA.address) && members.includes(fanB.address),
  p1AllPaid: p1.length === 6 && p1.every((x) => x.status === 'paid'),
  overCutRefused: n.overCut.status === 'refused' && n.overCut.reason === 'SpendingLimitExceeded',
  redirectRefused: n.redirect.status === 'refused' && n.redirect.reason === 'CallNotAllowed',
  feeRedirectRefused: n.feeRedirect.status === 'refused' && n.feeRedirect.reason === 'CallNotAllowed',
  creatorOverRefused: n.creatorOver.status === 'refused' && n.creatorOver.reason === 'SpendingLimitExceeded',
  nonMemberRefused: n.nonMember.status === 'refused',
  p2AllPaid: p2.every((x) => x.status === 'paid'),
  cancelRefused: afterCancel.status === 'refused',
  cancelledState: mA2.state === 'cancelled',
  ledger9: ledger.length === 9 && rows.filter((x) => x.complete).length === 3,
  creatorGot24: d.creator === shares.creator * 3n,
  platformGot: d.platform === shares.platform * 3n,
  feeGot: d.fee === shares.fee * 3n,
  fanAPaid20: d.fanA === -(shares.creator + shares.platform + shares.fee) * 2n,
  fanBPaid10: d.fanB === -(shares.creator + shares.platform + shares.fee),
  gasSponsored: d.fanAfeeDuringPulls === 0n && d.fanBfeeDuringPulls === 0n,
}
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
rec({ step: 'verdict', verdict: failed.length ? 'FAIL' : 'PASS', failed, checks: Object.keys(checks).length, log: logPath })
process.exit(failed.length ? 1 : 0)
