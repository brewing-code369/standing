import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createClient, getAddress, http as viemHttp, isAddress, isAddressEqual, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { chain, FEE_TOKEN, PATH_USD, publicClient } from '../src/core/chain'
import { discoverMembers, readRole } from '../src/core/membership'
import { planFromJson, planToJson, ROLES, split, toUnits, usd, validatePlan, type Plan, type Role } from '../src/core/plan'
import { pull, type PullResult } from '../src/core/pull'

const PORT = Number(process.env.PORT ?? 8787)
const DATA_DIR = process.env.DATA_DIR ?? './data'
const TICK_MS = Number(process.env.TICK_MS ?? 20_000)
const RPC_URL = process.env.RPC_URL
const SPONSOR_KEY = process.env.SPONSOR_KEY as Hex | undefined
const TREASURY = process.env.TREASURY as Address | undefined
if (!SPONSOR_KEY || !/^0x[0-9a-fA-F]{64}$/.test(SPONSOR_KEY)) throw new Error('SPONSOR_KEY is required')
if (!TREASURY || !isAddress(TREASURY)) throw new Error('TREASURY is required')
const SPONSOR = privateKeyToAddress(SPONSOR_KEY)
const ALLOWED_PERIODS = [120, 300, 3_600, 86_400, 604_800, 2_592_000]
const DEMO_TOPUP_BELOW = toUnits('20')
const PULL_GAP_MS = Number(process.env.PULL_GAP_MS ?? 700)

type PlanJson = ReturnType<typeof planToJson>
type RunRecord = { at: number; plan: string; member: Address; trigger: 'tick' | 'request' | 'attack'; results: (PullResult | { role: Role; member: Address; status: 'skipped'; reason: string })[] }
type State = {
  plans: Record<string, PlanJson>
  keys: Record<string, Record<Role, Hex>>
  members: Record<string, Address[]>
  cursor: Record<string, string>
  demoFans: Address[]
  runs: RunRecord[]
  lastTick: { at: number; ms: number; head: string; pulls: number; error?: string } | null
}

const statePath = path.join(DATA_DIR, 'state.json')
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
const state: State = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { plans: {}, keys: {}, members: {}, cursor: {}, demoFans: [], runs: [], lastTick: null }
state.demoFans = (process.env.DEMO_FANS ?? "").split(",").map((s) => s.trim()).filter((s) => isAddress(s)).map((s) => getAddress(s))
const save = () => {
  const tmp = `${statePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), { mode: 0o600 })
  fs.renameSync(tmp, statePath)
}

const pub = publicClient(RPC_URL)
const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const
const bal = (t: Address, a: Address) => pub.readContract({ address: t, abi: erc20, functionName: 'balanceOf', args: [a] })
const plan = (id: string): Plan | null => (state.plans[id] ? planFromJson(state.plans[id]) : null)
const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))

async function faucet(addr: Address) {
  await createClient({ chain, transport: viemHttp(RPC_URL) }).request({ method: 'tempo_fundAddress', params: [addr] } as never)
}

function remember(r: RunRecord) {
  state.runs.unshift(r)
  state.runs.length = Math.min(state.runs.length, 200)
}

function addMember(planId: string, member: Address) {
  const list = (state.members[planId] ??= [])
  if (!list.some((m) => isAddressEqual(m, member))) list.push(getAddress(member))
}

/** Pulls every share that is due for one member. Creator first: if the creator share cannot be paid, nobody is paid this round. */
async function runMember(p: Plan, member: Address): Promise<RunRecord['results']> {
  const keys = state.keys[p.id]
  const out: RunRecord['results'] = []
  for (const role of ROLES) {
    const st = await readRole(pub, p, member, role)
    if (st.status !== 'active') { out.push({ role, member, status: 'skipped', reason: `key ${st.status}` }); continue }
    if (!st.scopeOk) { out.push({ role, member, status: 'skipped', reason: 'scope does not match the plan' }); continue }
    if (st.remaining < p.shares[role]) continue
    if ((await bal(PATH_USD, member)) < p.shares[role]) {
      out.push({ role, member, status: 'skipped', reason: 'member balance below share' })
      if (role === 'creator') break
      continue
    }
    const r = await pull({ plan: p, role, member, pullKey: keys[role], sponsor: SPONSOR_KEY!, periodEnd: st.periodEnd, rpcUrl: RPC_URL })
    out.push(r)
    await new Promise((res) => setTimeout(res, PULL_GAP_MS))
    if (role === 'creator' && r.status !== 'paid') break
  }
  return out
}

let ticking = false
async function tick() {
  if (ticking) return
  ticking = true
  const t0 = Date.now()
  let pulls = 0
  try {
    const head = await pub.getBlockNumber()
    for (const id of Object.keys(state.plans)) {
      const p = plan(id)!
      const from = state.cursor[id] ? BigInt(state.cursor[id]) + 1n : p.createdBlock
      if (from <= head) {
        for (const m of await discoverMembers(pub, p, from, head)) addMember(id, m)
        state.cursor[id] = head.toString()
      }
      for (const m of state.members[id] ?? []) {
        const results = await runMember(p, m)
        const acted = results.filter((r) => r.status !== 'skipped' || r.reason === 'member balance below share')
        if (acted.length) { remember({ at: Date.now(), plan: id, member: m, trigger: 'tick', results }); pulls += acted.length }
      }
    }
    if ((await bal(FEE_TOKEN, SPONSOR)) < toUnits('5')) await faucet(SPONSOR)
    for (const f of state.demoFans) if ((await bal(PATH_USD, f)) < DEMO_TOPUP_BELOW) await faucet(f)
    state.lastTick = { at: Date.now(), ms: Date.now() - t0, head: head.toString(), pulls }
  } catch (e) {
    state.lastTick = { at: Date.now(), ms: Date.now() - t0, head: state.lastTick?.head ?? '0', pulls, error: ((e as Error).message ?? String(e)).slice(0, 300) }
    log({ tickError: state.lastTick.error })
  } finally {
    save()
    ticking = false
  }
}

// --- HTTP ---------------------------------------------------------------------------------------

const buckets = new Map<string, { n: number; reset: number }>()
function limited(ip: string, key: string, max: number, windowMs: number) {
  const k = `${ip}:${key}`
  const now = Date.now()
  const b = buckets.get(k)
  if (!b || b.reset < now) { buckets.set(k, { n: 1, reset: now + windowMs }); return false }
  b.n++
  return b.n > max
}

class HttpError extends Error { constructor(public code: number, msg: string) { super(msg) } }
const need = (cond: unknown, msg: string): void => { if (!cond) throw new HttpError(400, msg) }

async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let s = ''
  for await (const c of req) { s += c; if (s.length > 10_000) throw new HttpError(413, 'body too large') }
  try { return JSON.parse(s || '{}') } catch { throw new HttpError(400, 'body is not JSON') }
}

const str = (v: unknown, max: number, label: string) => {
  need(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max, `${label} must be 1 to ${max} characters`)
  return (v as string).trim()
}
const addr = (v: unknown, label: string) => {
  need(typeof v === 'string' && isAddress(v), `${label} must be an address`)
  return getAddress(v as string)
}

async function createPlan(b: Record<string, unknown>): Promise<PlanJson> {
  const creator = addr(b.creator, 'creator')
  const platform = addr(b.platform, 'platform')
  need(!isAddressEqual(creator, platform), 'creator and platform must be different addresses')
  need(!isAddressEqual(creator, TREASURY!) && !isAddressEqual(platform, TREASURY!), 'that address is the STANDING treasury')
  need(typeof b.price === 'string' && /^\d{1,5}(\.\d{1,6})?$/.test(b.price), 'price must look like 10.00')
  const total = toUnits(b.price as string)
  need(total >= toUnits('0.01') && total <= toUnits('10000'), 'price must be between 0.01 and 10000')
  need(Number.isInteger(b.platformBps) && (b.platformBps as number) > 100 && (b.platformBps as number) <= 9000, 'platform cut must be above 1% and at most 90%')
  need(ALLOWED_PERIODS.includes(b.period as number), `period must be one of ${ALLOWED_PERIODS.join(', ')} seconds`)
  let shares: Record<Role, bigint>
  try { shares = split(total, b.platformBps as number) } catch (e) { throw new HttpError(400, (e as Error).message) }
  let id: string
  do id = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, '0'); while (state.plans[id])
  const keys = { creator: generatePrivateKey(), platform: generatePrivateKey(), fee: generatePrivateKey() }
  const p: Plan = validatePlan({
    id,
    name: str(b.name, 60, 'name'),
    creatorName: str(b.creatorName, 40, 'creator name'),
    platformName: str(b.platformName, 40, 'platform name'),
    recipients: { creator, platform, fee: getAddress(TREASURY!) },
    shares,
    keys: { creator: privateKeyToAddress(keys.creator), platform: privateKeyToAddress(keys.platform), fee: privateKeyToAddress(keys.fee) },
    period: b.period as number,
    createdBlock: await pub.getBlockNumber(),
    createdAt: Math.floor(Date.now() / 1000),
  })
  state.plans[id] = planToJson(p)
  state.keys[id] = keys
  state.members[id] = []
  save()
  log({ planCreated: id, name: p.name, price: usd(total), period: p.period })
  return state.plans[id]
}

const ATTACKER: Address = '0x000000000000000000000000000000000000dEaD'

async function attack(p: Plan, member: Address, kind: string) {
  const keys = state.keys[p.id]
  const base = { plan: p, sponsor: SPONSOR_KEY!, periodEnd: Math.floor(Date.now() / 1000), rpcUrl: RPC_URL }
  if (kind === 'overcut') return { kind, attempt: `platform key pulls ${usd(p.shares.platform * 2n)}, twice its cut`, ...(await pull({ ...base, role: 'platform', member, pullKey: keys.platform, amount: p.shares.platform * 2n })) }
  if (kind === 'redirect') return { kind, attempt: `platform key sends ${usd(p.shares.platform)} to ${ATTACKER}`, ...(await pull({ ...base, role: 'platform', member, pullKey: keys.platform, to: ATTACKER })) }
  if (kind === 'creator-redirect') return { kind, attempt: `creator key sends the creator share to the platform`, ...(await pull({ ...base, role: 'creator', member, pullKey: keys.creator, to: p.recipients.platform })) }
  if (kind === 'outsider') {
    const stranger = privateKeyToAddress(generatePrivateKey())
    return { kind, attempt: `creator key pulls from ${stranger}, who never subscribed`, ...(await pull({ ...base, role: 'creator', member: stranger, pullKey: keys.creator })) }
  }
  throw new HttpError(400, 'kind must be overcut, redirect, creator-redirect or outsider')
}

const json = (res: http.ServerResponse, code: number, v: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' })
  res.end(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  const ip = (req.headers['fly-client-ip'] as string) ?? req.socket.remoteAddress ?? '?'
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' })
    return res.end()
  }
  try {
    const p = url.pathname
    if (req.method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, chainId: chain.id, plans: Object.keys(state.plans).length, lastTick: state.lastTick })
    if (req.method === 'GET' && p === '/api/plans') return json(res, 200, Object.values(state.plans).sort((a, b) => b.createdAt - a.createdAt))
    const m = p.match(/^\/api\/plans\/([0-9a-f]{8})$/)
    if (req.method === 'GET' && m) return state.plans[m[1]] ? json(res, 200, state.plans[m[1]]) : json(res, 404, { error: 'no such plan' })
    if (req.method === 'GET' && p === '/api/runner') {
      const [sFee, sUsd] = await Promise.all([bal(FEE_TOKEN, SPONSOR), bal(PATH_USD, SPONSOR)])
      const planId = url.searchParams.get('plan')
      const member = url.searchParams.get('member')
      const recent = state.runs.filter((r) => (!planId || r.plan === planId) && (!member || (isAddress(member) && isAddressEqual(r.member, member)))).slice(0, 30)
      return json(res, 200, { tickMs: TICK_MS, lastTick: state.lastTick, sponsor: SPONSOR, sponsorGasBalance: usd(sFee), sponsorPathUsd: usd(sUsd), members: Object.fromEntries(Object.entries(state.members).map(([k, v]) => [k, v.length])), recent })
    }
    if (req.method === 'POST' && p === '/api/plans') {
      if (limited(ip, 'plans', 10, 3_600_000)) throw new HttpError(429, 'too many plans from this address, try again in an hour')
      return json(res, 201, await createPlan(await body(req)))
    }
    if (req.method === 'POST' && (p === '/api/run' || p === '/api/attack')) {
      if (limited(ip, p, 30, 60_000)) throw new HttpError(429, 'slow down, at most 30 requests a minute')
      const b = await body(req)
      need(typeof b.plan === 'string' && state.plans[b.plan as string], 'unknown plan')
      const pl = plan(b.plan as string)!
      const member = addr(b.member, 'member')
      if (p === '/api/run') {
        const results = await runMember(pl, member)
        if (results.some((r) => r.status === 'paid')) addMember(pl.id, member)
        remember({ at: Date.now(), plan: pl.id, member, trigger: 'request', results })
        save()
        return json(res, 200, { results })
      }
      const r = await attack(pl, member, String(b.kind))
      remember({ at: Date.now(), plan: pl.id, member, trigger: 'attack', results: [r as PullResult] })
      save()
      return json(res, 200, r)
    }
    return json(res, 404, { error: 'not found' })
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.code, { error: e.message })
    log({ error: ((e as Error).stack ?? String(e)).slice(0, 500) })
    return json(res, 500, { error: 'internal error' })
  }
})

server.listen(PORT, () => {
  log({ listening: PORT, sponsor: SPONSOR, treasury: TREASURY, plans: Object.keys(state.plans).length, tickMs: TICK_MS })
  void tick()
  setInterval(() => void tick(), TICK_MS)
})
