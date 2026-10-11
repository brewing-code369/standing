import { getAddress, isAddressEqual, type Address, type Hex } from 'viem'
import { MAX_LOG_RANGE, PATH_USD, transferWithMemoEvent, type PublicClient } from './chain'
import { decodeMemo } from './memo'
import { ROLES, type Plan, type Role } from './plan'

export type LedgerEntry = {
  plan: string
  member: Address
  role: Role
  amount: bigint
  periodEnd: number
  tx: Hex
  block: bigint
}

/** Every STANDING renewal pull for `plan`, read from pathUSD TransferWithMemo logs and keyed by memo. */
export async function readLedger(pub: PublicClient, plan: Plan, toBlock?: bigint): Promise<LedgerEntry[]> {
  const head = toBlock ?? (await pub.getBlockNumber())
  const out: LedgerEntry[] = []
  await Promise.all(ROLES.map(async (role) => {
    for (let start = plan.createdBlock; start <= head; start += MAX_LOG_RANGE) {
      const end = start + MAX_LOG_RANGE - 1n < head ? start + MAX_LOG_RANGE - 1n : head
      const logs = await pub.getLogs({ address: PATH_USD, event: transferWithMemoEvent, args: { to: plan.recipients[role] }, fromBlock: start, toBlock: end })
      for (const l of logs) {
        const m = l.args.memo ? decodeMemo(l.args.memo) : null
        if (!m || m.planId !== plan.id || m.role !== role || !l.args.from || !l.args.to || !isAddressEqual(l.args.to, plan.recipients[role])) continue
        out.push({ plan: plan.id, member: getAddress(l.args.from), role, amount: l.args.amount ?? 0n, periodEnd: m.periodEnd, tx: l.transactionHash, block: l.blockNumber })
      }
    }
  }))
  return out.sort((a, b) => (a.block === b.block ? ROLES.indexOf(a.role) - ROLES.indexOf(b.role) : a.block < b.block ? -1 : 1))
}

export type Renewal = { member: Address; periodEnd: number; pulls: Partial<Record<Role, LedgerEntry>>; complete: boolean }

/** Groups pulls into renewals: one row per member and period, complete when all three parties were paid. */
export function renewals(entries: LedgerEntry[]): Renewal[] {
  const map = new Map<string, Renewal>()
  for (const e of entries) {
    const k = `${e.member}:${e.periodEnd}`
    const r = map.get(k) ?? { member: e.member, periodEnd: e.periodEnd, pulls: {}, complete: false }
    r.pulls[e.role] = e
    r.complete = ROLES.every((x) => r.pulls[x])
    map.set(k, r)
  }
  return [...map.values()].sort((a, b) => b.periodEnd - a.periodEnd)
}
