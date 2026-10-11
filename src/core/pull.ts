import { createClient, encodeFunctionData, http, publicActions, walletActions, type Address, type Hex } from 'viem'
import { Abis, Account } from 'viem/tempo'
import { chain, PATH_USD } from './chain'
import { encodeMemo } from './memo'
import type { Plan, Role } from './plan'

export const REFUSALS = [
  'CallNotAllowed',
  'SpendingLimitExceeded',
  'KeyAlreadyRevoked',
  'KeyNotFound',
  'KeyExpired',
  'InsufficientBalance',
  'Unauthorized',
] as const
export type Refusal = (typeof REFUSALS)[number]

/** Finds the protocol's revert name anywhere in a viem error chain; null when the failure is not a protocol refusal. */
export function refusalName(e: unknown): Refusal | null {
  const parts: string[] = []
  let cur: unknown = e
  for (let i = 0; cur && i < 8; i++) {
    const x = cur as { shortMessage?: string; message?: string; details?: string; cause?: unknown }
    parts.push(x.shortMessage ?? '', x.message ?? '', x.details ?? '')
    cur = x.cause
  }
  const text = parts.join(' | ')
  return REFUSALS.find((r) => text.includes(r)) ?? null
}

export const RATE_LIMIT_RETRIES = 4

/** The public RPC rejects bursts before broadcasting ("Request exceeds defined limit"), so a retry cannot double-pay. */
export function isRateLimited(e: unknown): boolean {
  let cur: unknown = e
  for (let i = 0; cur && i < 8; i++) {
    const x = cur as { message?: string; details?: string; status?: number; cause?: unknown }
    if (x.status === 429 || /exceeds defined limit|rate limit|too many requests/i.test(`${x.message ?? ''} ${x.details ?? ''}`)) return true
    cur = x.cause
  }
  return false
}

export type PullResult =
  | { role: Role; member: Address; status: 'paid'; tx: Hex; amount: bigint; periodEnd: number }
  | { role: Role; member: Address; status: 'refused'; reason: Refusal }
  | { role: Role; member: Address; status: 'reverted'; tx: Hex }
  | { role: Role; member: Address; status: 'error'; message: string }

export type PullInput = {
  plan: Plan
  role: Role
  member: Address
  pullKey: Hex
  sponsor: Hex
  periodEnd: number
  amount?: bigint
  to?: Address
  rpcUrl?: string
}

/**
 * One renewal pull: the role's access key signs a transferWithMemo from the member's account to the role's
 * recipient, and the sponsor pays the gas. `amount` and `to` exist only so tests can attempt what the chain must refuse.
 */
export async function pull(i: PullInput): Promise<PullResult> {
  const { plan, role, member } = i
  const key = Account.fromSecp256k1(i.pullKey, { access: member })
  const sponsor = Account.fromSecp256k1(i.sponsor)
  const amount = i.amount ?? plan.shares[role]
  const to = i.to ?? plan.recipients[role]
  const client = createClient({ account: key, chain, transport: http(i.rpcUrl) }).extend(publicActions).extend(walletActions)
  const data = encodeFunctionData({
    abi: Abis.tip20,
    functionName: 'transferWithMemo',
    args: [to, amount, encodeMemo({ planId: plan.id, role, periodEnd: i.periodEnd })],
  })
  let tx: Hex | undefined
  for (let attempt = 0; !tx; attempt++) {
    try {
      tx = await client.sendTransaction({ calls: [{ to: PATH_USD, data }], feePayer: sponsor } as never)
    } catch (e) {
      const reason = refusalName(e)
      if (reason) return { role, member, status: 'refused', reason }
      if (isRateLimited(e) && attempt < RATE_LIMIT_RETRIES) {
        await new Promise((r) => setTimeout(r, 1_500 * 2 ** attempt))
        continue
      }
      return { role, member, status: 'error', message: ((e as Error).message ?? String(e)).slice(0, 300) }
    }
  }
  const r = await client.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  if (r.status !== 'success') return { role, member, status: 'reverted', tx }
  return { role, member, status: 'paid', tx, amount, periodEnd: i.periodEnd }
}
