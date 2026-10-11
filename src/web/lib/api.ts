import type { Address, Hex } from 'viem'
import { planFromJson, type Plan } from '../../core/plan'

const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

const DEMO_PERIOD = 300

export class ApiError extends Error {
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message)
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new ApiError('The renewal runner is not answering.', true)
  }
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ApiError(res.ok ? 'The renewal runner sent something that is not JSON.' : `The renewal runner answered ${res.status}.`, !res.ok && res.status >= 500)
  }
  if (!res.ok) throw new ApiError(((json as { error?: string }).error ?? `The renewal runner answered ${res.status}.`), false)
  return json as T
}

type Role = 'creator' | 'platform' | 'fee'
export type PullResultJson =
  | { role: Role; member: Address; status: 'paid'; tx: Hex; amount: string; periodEnd: number }
  | { role: Role; member: Address; status: 'refused'; reason: string }
  | { role: Role; member: Address; status: 'reverted'; tx: Hex }
  | { role: Role; member: Address; status: 'error'; message: string }
  | { role: Role; member: Address; status: 'skipped'; reason: string }

export type AttackKind = 'overcut' | 'redirect' | 'creator-redirect' | 'outsider'
export type AttackResult = PullResultJson & { kind: AttackKind; attempt: string }
export type RunRecord = { at: number; plan: string; member: Address; trigger: 'tick' | 'request' | 'attack'; results: PullResultJson[] }
export type RunnerInfo = { tickMs: number; lastTick: { at: number; ms: number; head: string; pulls: number; error?: string } | null; recent: RunRecord[] }

export type NewPlan = { name: string; creatorName: string; platformName: string; creator: Address; platform: Address; price: string; platformBps: number; period: number }

export const api = {
  /** The demo plan: VITE_DEMO_PLAN when set, otherwise the newest plan that renews every 5 minutes, otherwise the newest plan. */
  demoPlan: async (): Promise<Plan | null> => {
    const all = await api.plans()
    const pinned = import.meta.env.VITE_DEMO_PLAN as string | undefined
    return all.find((p) => p.id === pinned) ?? all.find((p) => p.period === DEMO_PERIOD) ?? all[0] ?? null
  },
  plans: async (): Promise<Plan[]> => (await call<Parameters<typeof planFromJson>[0][]>('/api/plans')).map(planFromJson),
  plan: async (id: string): Promise<Plan> => planFromJson(await call(`/api/plans/${encodeURIComponent(id)}`)),
  createPlan: async (p: NewPlan): Promise<Plan> => planFromJson(await call('/api/plans', p)),
  run: (plan: string, member: Address) => call<{ results: PullResultJson[] }>('/api/run', { plan, member }),
  attack: (plan: string, member: Address, kind: AttackKind) => call<AttackResult>('/api/attack', { plan, member, kind }),
  health: () => call<{ ok: boolean; lastTick: { at: number; error?: string } | null }>('/api/health'),
  runner: (plan?: string, member?: Address) => call<RunnerInfo>(`/api/runner${plan ? `?plan=${plan}${member ? `&member=${member}` : ''}` : ''}`),
}
