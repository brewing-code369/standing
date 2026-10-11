import type { Address } from 'viem'
import { publicClient } from '../../core/chain'
import { readLedger, renewals, type LedgerEntry, type Renewal } from '../../core/ledger'
import { readMembership, type Membership } from '../../core/membership'
import type { Plan } from '../../core/plan'

/** Blocks of history the landing proof reads: the latest renewals, not the plan's whole life. */
export const LEDGER_WINDOW = 400_000n

export const pub = publicClient()

export async function loadLedger(plan: Plan, windowed = false): Promise<{ entries: LedgerEntry[]; renewals: Renewal[]; head: bigint }> {
  const head = await pub.getBlockNumber()
  const from = windowed && head - LEDGER_WINDOW > plan.createdBlock ? head - LEDGER_WINDOW : plan.createdBlock
  const entries = await readLedger(pub, { ...plan, createdBlock: from }, head)
  return { entries, renewals: renewals(entries), head }
}

export const loadMembership = (plan: Plan, account: Address): Promise<Membership> => readMembership(pub, plan, account)
