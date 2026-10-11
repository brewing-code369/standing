import { getAddress, isAddressEqual, zeroAddress, type Address } from 'viem'
import { Abis } from 'viem/tempo'
import { ACCOUNT_KEYCHAIN, FEE_TOKEN, keyAuthorizedEvent, MAX_LOG_RANGE, PATH_USD, TRANSFER_WITH_MEMO, type PublicClient } from './chain'
import { ROLES, type Plan, type Role } from './plan'

export type KeyStatus = 'none' | 'active' | 'revoked' | 'expired'

export type RoleState = {
  role: Role
  keyId: Address
  status: KeyStatus
  expiry: number
  remaining: bigint
  periodEnd: number
  scopeOk: boolean
  scope: { anyCalls: boolean; target?: Address; selector?: string; recipients: Address[] }
}

export type Membership = {
  account: Address
  plan: string
  state: 'active' | 'cancelled' | 'none' | 'partial'
  roles: Record<Role, RoleState>
  balance: bigint
  feeBalance: bigint
}

const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const

export async function readRole(pub: PublicClient, plan: Plan, account: Address, role: Role, now = Math.floor(Date.now() / 1000)): Promise<RoleState> {
  const keyId = plan.keys[role]
  const [key, limit, calls] = await Promise.all([
    pub.readContract({ address: ACCOUNT_KEYCHAIN, abi: Abis.accountKeychain, functionName: 'getKey', args: [account, keyId] }),
    pub.readContract({ address: ACCOUNT_KEYCHAIN, abi: Abis.accountKeychain, functionName: 'getRemainingLimitWithPeriod', args: [account, keyId, PATH_USD] }),
    pub.readContract({ address: ACCOUNT_KEYCHAIN, abi: Abis.accountKeychain, functionName: 'getAllowedCalls', args: [account, keyId] }),
  ])
  const k = key as { keyId: Address; expiry: bigint; isRevoked: boolean; enforceLimits: boolean }
  const [remaining, periodEnd] = limit as readonly [bigint, bigint]
  const [isScoped, scopes] = calls as readonly [boolean, readonly { target: Address; selectorRules: readonly { selector: string; recipients: readonly Address[] }[] }[]]
  const scope0 = scopes[0]
  const rule0 = scope0?.selectorRules[0]
  const scope = {
    anyCalls: !isScoped,
    target: scope0?.target,
    selector: rule0?.selector,
    recipients: [...(rule0?.recipients ?? [])].map((a) => getAddress(a)),
  }
  const scopeOk =
    isScoped &&
    scopes.length === 1 &&
    scope0.selectorRules.length === 1 &&
    isAddressEqual(scope0.target, PATH_USD) &&
    rule0!.selector.toLowerCase() === TRANSFER_WITH_MEMO &&
    scope.recipients.length === 1 &&
    isAddressEqual(scope.recipients[0], plan.recipients[role]) &&
    k.enforceLimits
  const status: KeyStatus = k.isRevoked
    ? 'revoked'
    : isAddressEqual(k.keyId, zeroAddress)
      ? 'none'
      : Number(k.expiry) !== 0 && Number(k.expiry) <= now
        ? 'expired'
        : 'active'
  return { role, keyId, status, expiry: Number(k.expiry), remaining, periodEnd: Number(periodEnd), scopeOk, scope }
}

export async function readMembership(pub: PublicClient, plan: Plan, account: Address): Promise<Membership> {
  const [creator, platform, fee, balance, feeBalance] = await Promise.all([
    readRole(pub, plan, account, 'creator'),
    readRole(pub, plan, account, 'platform'),
    readRole(pub, plan, account, 'fee'),
    pub.readContract({ address: PATH_USD, abi: erc20, functionName: 'balanceOf', args: [account] }),
    pub.readContract({ address: FEE_TOKEN, abi: erc20, functionName: 'balanceOf', args: [account] }),
  ])
  const roles = { creator, platform, fee }
  const st = ROLES.map((r) => roles[r].status)
  const state = st.every((s) => s === 'active' ) && ROLES.every((r) => roles[r].scopeOk)
    ? 'active'
    : st.some((s) => s === 'revoked')
      ? 'cancelled'
      : st.every((s) => s === 'none')
        ? 'none'
        : 'partial'
  return { account, plan: plan.id, state, roles, balance, feeBalance }
}

/** Fan accounts that authorized this plan's creator pull key, from `fromBlock` to `toBlock`, paged under the RPC's range cap. */
export async function discoverMembers(pub: PublicClient, plan: Plan, fromBlock: bigint, toBlock: bigint): Promise<Address[]> {
  const out = new Set<Address>()
  for (let start = fromBlock; start <= toBlock; start += MAX_LOG_RANGE) {
    const end = start + MAX_LOG_RANGE - 1n < toBlock ? start + MAX_LOG_RANGE - 1n : toBlock
    const logs = await pub.getLogs({ address: ACCOUNT_KEYCHAIN, event: keyAuthorizedEvent, args: { publicKey: plan.keys.creator }, fromBlock: start, toBlock: end })
    for (const l of logs) if (l.args.account) out.add(getAddress(l.args.account))
  }
  return [...out]
}
