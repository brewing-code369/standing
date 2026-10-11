import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { tempoModerato } from 'viem/chains'

export const PATH_USD: Address = '0x20c0000000000000000000000000000000000000'
export const FEE_TOKEN: Address = '0x20c0000000000000000000000000000000000001'
export const ACCOUNT_KEYCHAIN: Address = '0xaAAAaaAA00000000000000000000000000000000'
export const TRANSFER_WITH_MEMO = '0x95777d59' as const
export const DECIMALS = 6
export const EXPLORER = 'https://explore.testnet.tempo.xyz'
export const MAX_LOG_RANGE = 100_000n

export const chain = tempoModerato.extend({ feeToken: FEE_TOKEN })

export function publicClient(rpcUrl?: string) {
  return createPublicClient({ chain, transport: http(rpcUrl) })
}
export type PublicClient = ReturnType<typeof publicClient>

export const transferWithMemoEvent = parseAbiItem(
  'event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)',
)
export const keyAuthorizedEvent = parseAbiItem(
  'event KeyAuthorized(address indexed account, address indexed publicKey, uint8 signatureType, uint64 expiry)',
)
export const keyRevokedEvent = parseAbiItem('event KeyRevoked(address indexed account, address indexed publicKey)')

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`
export const blockUrl = (n: string | number | bigint) => `${EXPLORER}/block/${n}`
