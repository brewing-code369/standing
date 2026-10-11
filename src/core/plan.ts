import { formatUnits, getAddress, isAddress, parseUnits, type Address } from 'viem'
import { DECIMALS } from './chain'

export const ROLES = ['creator', 'platform', 'fee'] as const
export type Role = (typeof ROLES)[number]

export type Plan = {
  id: string
  name: string
  creatorName: string
  platformName: string
  recipients: Record<Role, Address>
  shares: Record<Role, bigint>
  keys: Record<Role, Address>
  period: number
  createdBlock: bigint
  createdAt: number
}

export const MIN_PERIOD = 60
export const DEFAULT_FEE_BPS = 100

export const usd = (v: bigint) => formatUnits(v, DECIMALS)
export const toUnits = (v: string) => parseUnits(v, DECIMALS)
export const price = (p: Pick<Plan, 'shares'>) => p.shares.creator + p.shares.platform + p.shares.fee

/** Splits a price into creator, platform and fee shares. The fee comes out of the platform's cut. */
export function split(total: bigint, platformBps: number, feeBps = DEFAULT_FEE_BPS): Record<Role, bigint> {
  if (total <= 0n) throw new Error('price must be above zero')
  if (!Number.isInteger(platformBps) || platformBps <= 0 || platformBps >= 10_000) throw new Error('platform cut must be between 0.01% and 99.99%')
  if (!Number.isInteger(feeBps) || feeBps <= 0) throw new Error('fee must be above zero')
  const cut = (total * BigInt(platformBps)) / 10_000n
  const fee = (total * BigInt(feeBps)) / 10_000n
  if (fee >= cut) throw new Error('the STANDING fee must be smaller than the platform cut')
  return { creator: total - cut, platform: cut - fee, fee }
}

export function validatePlan(p: Plan): Plan {
  if (!/^[0-9a-f]{8}$/.test(p.id)) throw new Error('plan id must be 8 hex characters')
  for (const r of ROLES) {
    if (!isAddress(p.recipients[r])) throw new Error(`${r} recipient is not an address`)
    if (!isAddress(p.keys[r])) throw new Error(`${r} pull key is not an address`)
    if (p.shares[r] <= 0n) throw new Error(`${r} share must be above zero`)
  }
  const recips = new Set(ROLES.map((r) => getAddress(p.recipients[r])))
  if (recips.size !== 3) throw new Error('creator, platform and fee recipients must be three different addresses')
  const keys = new Set(ROLES.map((r) => getAddress(p.keys[r])))
  if (keys.size !== 3) throw new Error('each role needs its own pull key')
  for (const k of keys) if (recips.has(k)) throw new Error('a pull key cannot also be a recipient')
  if (!Number.isInteger(p.period) || p.period < MIN_PERIOD) throw new Error(`period must be at least ${MIN_PERIOD} seconds`)
  return p
}

type PlanJson = Omit<Plan, 'shares' | 'createdBlock'> & { shares: Record<Role, string>; createdBlock: string }

export const planToJson = (p: Plan): PlanJson => ({
  ...p,
  shares: { creator: p.shares.creator.toString(), platform: p.shares.platform.toString(), fee: p.shares.fee.toString() },
  createdBlock: p.createdBlock.toString(),
})

export const planFromJson = (j: PlanJson): Plan =>
  validatePlan({
    ...j,
    shares: { creator: BigInt(j.shares.creator), platform: BigInt(j.shares.platform), fee: BigInt(j.shares.fee) },
    createdBlock: BigInt(j.createdBlock),
  })

export function periodLabel(seconds: number): string {
  if (seconds % 2_592_000 === 0) return seconds === 2_592_000 ? 'month' : `${seconds / 2_592_000} months`
  if (seconds % 604_800 === 0) return seconds === 604_800 ? 'week' : `${seconds / 604_800} weeks`
  if (seconds % 86_400 === 0) return seconds === 86_400 ? 'day' : `${seconds / 86_400} days`
  if (seconds % 3_600 === 0) return seconds === 3_600 ? 'hour' : `${seconds / 3_600} hours`
  if (seconds % 60 === 0) return seconds === 60 ? 'minute' : `${seconds / 60} minutes`
  return `${seconds} seconds`
}
