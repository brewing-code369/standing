import { decodeFunctionData, getAddress, type Address } from 'viem'
import { Abis } from 'viem/tempo'
import { describe, expect, it } from 'vitest'
import { cancelCalls, checkoutCalls } from './calls'
import { ACCOUNT_KEYCHAIN, PATH_USD, TRANSFER_WITH_MEMO } from './chain'
import { decodeMemo, encodeMemo } from './memo'
import { planFromJson, planToJson, split, toUnits, validatePlan, type Plan } from './plan'
import { isRateLimited, refusalName } from './pull'
import { renewals, type LedgerEntry } from './ledger'

const a = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address
const plan: Plan = {
  id: 'a1b2c3d4',
  name: 'Studio membership',
  creatorName: 'Mira',
  platformName: 'Kiln',
  recipients: { creator: a(1), platform: a(2), fee: a(3) },
  shares: split(toUnits('10'), 2000, 100),
  keys: { creator: a(11), platform: a(12), fee: a(13) },
  period: 2_592_000,
  createdBlock: 39_000_000n,
  createdAt: 1_760_000_000,
}

describe('split', () => {
  it('takes the fee out of the platform cut, never the creator share', () => {
    expect(split(toUnits('10'), 2000, 100)).toEqual({ creator: toUnits('8'), platform: toUnits('1.9'), fee: toUnits('0.1') })
  })
  it('always sums to the price', () => {
    for (const [p, bps, fee] of [['7.77', 1500, 50], ['0.03', 3333, 1], ['1000', 9999, 9998]] as const) {
      const s = split(toUnits(p), bps, fee)
      expect(s.creator + s.platform + s.fee).toBe(toUnits(p))
    }
  })
  it('refuses a fee that eats the whole platform cut', () => {
    expect(() => split(toUnits('10'), 100, 100)).toThrow(/smaller than the platform cut/)
  })
})

describe('validatePlan', () => {
  it('accepts a sound plan and round-trips through JSON', () => {
    expect(planFromJson(JSON.parse(JSON.stringify(planToJson(plan))))).toEqual(plan)
  })
  it('refuses a pull key that is also a recipient', () => {
    expect(() => validatePlan({ ...plan, keys: { ...plan.keys, platform: a(1) } })).toThrow(/cannot also be a recipient/)
  })
  it('refuses two roles paying the same address', () => {
    expect(() => validatePlan({ ...plan, recipients: { ...plan.recipients, fee: a(2) } })).toThrow(/three different addresses/)
  })
  it('refuses a period under a minute', () => {
    expect(() => validatePlan({ ...plan, period: 59 })).toThrow(/at least 60/)
  })
})

describe('memo', () => {
  it('round-trips plan, role and period end', () => {
    const m = { planId: 'a1b2c3d4', role: 'platform' as const, periodEnd: 1_762_592_000 }
    expect(decodeMemo(encodeMemo(m))).toEqual(m)
  })
  it('ignores memos that are not ours', () => {
    expect(decodeMemo(`0x${'00'.repeat(32)}`)).toBeNull()
    expect(decodeMemo(`0x${'53544e44'}02${'00'.repeat(27)}`)).toBeNull()
  })
})

describe('checkoutCalls', () => {
  const calls = checkoutCalls(plan, 1_760_000_000)
  it('installs exactly one key per role, each bound to its own recipient and capped at its own share', () => {
    expect(calls).toHaveLength(3)
    const roles = ['creator', 'platform', 'fee'] as const
    calls.forEach((c, i) => {
      expect(c.to).toBe(ACCOUNT_KEYCHAIN)
      const d = decodeFunctionData({ abi: Abis.accountKeychain, data: c.data })
      expect(d.functionName).toBe('authorizeKey')
      const [keyId, sigType, cfg] = d.args as unknown as [Address, number, {
        enforceLimits: boolean; allowAnyCalls: boolean
        limits: { token: Address; amount: bigint; period: bigint }[]
        allowedCalls: { target: Address; selectorRules: { selector: string; recipients: Address[] }[] }[]
      }]
      const r = roles[i]
      expect(keyId.toLowerCase()).toBe(plan.keys[r])
      expect(sigType).toBe(0)
      expect(cfg.enforceLimits).toBe(true)
      expect(cfg.allowAnyCalls).toBe(false)
      expect(cfg.limits).toEqual([{ token: getAddress(PATH_USD), amount: plan.shares[r], period: BigInt(plan.period) }])
      expect(cfg.allowedCalls).toHaveLength(1)
      expect(cfg.allowedCalls[0].target).toBe(getAddress(PATH_USD))
      expect(cfg.allowedCalls[0].selectorRules).toHaveLength(1)
      expect(cfg.allowedCalls[0].selectorRules[0].selector).toBe(TRANSFER_WITH_MEMO)
      expect(cfg.allowedCalls[0].selectorRules[0].recipients.map((x) => x.toLowerCase())).toEqual([plan.recipients[r]])
    })
  })
  it('cancel revokes every plan key', () => {
    const c = cancelCalls(plan)
    expect(c.map((x) => (decodeFunctionData({ abi: Abis.accountKeychain, data: x.data }).args as unknown as [Address])[0].toLowerCase())).toEqual([a(11), a(12), a(13)])
  })
})

describe('refusalName', () => {
  it('finds the protocol revert anywhere in the error chain', () => {
    const e = { shortMessage: 'An internal error was received.', cause: { details: 'Revm error: keychain validation failed: AccountKeychainError(KeyAlreadyRevoked(KeyAlreadyRevoked))' } }
    expect(refusalName(e)).toBe('KeyAlreadyRevoked')
    expect(refusalName(new Error('fetch failed'))).toBeNull()
  })
  it('treats an RPC burst limit as retryable and a refusal as final', () => {
    expect(isRateLimited({ shortMessage: 'HTTP request failed.', cause: { message: 'Request exceeds defined limit.\n\nURL: https://rpc.moderato.tempo.xyz' } })).toBe(true)
    expect(isRateLimited({ status: 429 })).toBe(true)
    expect(isRateLimited({ details: 'keychain validation failed: SpendingLimitExceeded' })).toBe(false)
  })
})

describe('renewals', () => {
  it('marks a period complete only when all three parties were paid', () => {
    const e = (role: LedgerEntry['role'], periodEnd: number): LedgerEntry => ({ plan: plan.id, member: a(99), role, amount: 1n, periodEnd, tx: '0x01', block: 1n })
    const rows = renewals([e('creator', 2), e('platform', 2), e('fee', 2), e('creator', 1), e('platform', 1)])
    expect(rows.map((r) => [r.periodEnd, r.complete])).toEqual([[2, true], [1, false]])
  })
})
