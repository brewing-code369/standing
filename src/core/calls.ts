import { encodeFunctionData, type Address, type Hex } from 'viem'
import { Abis } from 'viem/tempo'
import { ACCOUNT_KEYCHAIN, PATH_USD, TRANSFER_WITH_MEMO } from './chain'
import { ROLES, type Plan, type Role } from './plan'

export type Call = { to: Address; data: Hex }

export const KEY_LIFETIME_SECONDS = 365 * 86_400

/** One recipient-bound periodic key: only transferWithMemo of pathUSD, only to `recipient`, at most `amount` per period. */
export function keyConfig(amount: bigint, recipient: Address, period: number, expiry: bigint) {
  return {
    expiry,
    enforceLimits: true,
    limits: [{ token: PATH_USD, amount, period: BigInt(period) }],
    allowAnyCalls: false,
    allowedCalls: [{ target: PATH_USD, selectorRules: [{ selector: TRANSFER_WITH_MEMO, recipients: [recipient] }] }],
  } as const
}

const keychain = (functionName: 'authorizeKey' | 'revokeKey', args: readonly unknown[]): Call => ({
  to: ACCOUNT_KEYCHAIN,
  data: encodeFunctionData({ abi: Abis.accountKeychain, functionName, args } as never),
})

/** The whole checkout: three authorizeKey calls, signed once by the fan's root key in one Tempo transaction. */
export function checkoutCalls(plan: Plan, nowSeconds = Math.floor(Date.now() / 1000)): Call[] {
  const expiry = BigInt(nowSeconds + KEY_LIFETIME_SECONDS)
  return ROLES.map((r) => keychain('authorizeKey', [plan.keys[r], 0, keyConfig(plan.shares[r], plan.recipients[r], plan.period, expiry)]))
}

/** Cancel: revoke every pull key of the plan in one transaction. */
export function cancelCalls(plan: Plan, roles: readonly Role[] = ROLES): Call[] {
  return roles.map((r) => keychain('revokeKey', [plan.keys[r]]))
}
