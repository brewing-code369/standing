import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { chain, type PublicClient } from '../../core/chain'
import { readLedger, renewals, type LedgerEntry, type Renewal } from '../../core/ledger'
import { readMembership, type Membership } from '../../core/membership'
import type { Plan } from '../../core/plan'

/** Blocks of history the landing proof reads: the latest renewals, not the plan's whole life. */
export const LEDGER_WINDOW = 400_000n

/** Browser reads batch JSON-RPC calls and retry the RPC's burst limit with backoff. */
export const pub = createPublicClient({ chain, transport: http(undefined, { batch: { wait: 25 }, retryCount: 6, retryDelay: 400 }) }) as unknown as PublicClient

export async function loadLedger(plan: Plan, windowed = false): Promise<{ entries: LedgerEntry[]; renewals: Renewal[]; head: bigint }> {
  const head = await pub.getBlockNumber()
  const from = windowed && head - LEDGER_WINDOW > plan.createdBlock ? head - LEDGER_WINDOW : plan.createdBlock
  const entries = await readLedger(pub, { ...plan, createdBlock: from }, head)
  return { entries, renewals: renewals(entries), head }
}

export const loadMembership = (plan: Plan, account: Address): Promise<Membership> => readMembership(pub, plan, account)
