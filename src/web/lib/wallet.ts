import { createClient, http, publicActions, walletActions, type Address, type Hex } from 'viem'
import { Account, WebAuthnP256, WebCryptoP256 } from 'viem/tempo'
import { chain, FEE_TOKEN, PATH_USD, publicClient } from '../../core/chain'
import type { Call } from '../../core/calls'
import { toUnits } from '../../core/plan'

export type WalletKind = 'browser' | 'passkey'
export type Wallet = { kind: WalletKind; address: Address; account: ReturnType<typeof Account.fromWebCryptoP256> }

type KeyPair = Awaited<ReturnType<typeof WebCryptoP256.createKeyPair>>
type StoredPasskey = { id: string; publicKey: Hex }

const DB = 'standing'
const STORE = 'keys'
const BROWSER_KEY = 'browser-key'
const PASSKEY = 'standing.passkey'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error ?? new Error('IndexedDB is unavailable in this browser.'))
  })
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'))
  })
}

const asWallet = (kind: WalletKind, account: Wallet['account']): Wallet => ({ kind, address: account.address, account })

export const hasBrowserKey = async () => (await idb<KeyPair | undefined>('readonly', (s) => s.get(BROWSER_KEY))) !== undefined

/** The browser key: a non-extractable WebCrypto P256 pair persisted in IndexedDB, created on first use. */
export async function browserWallet(): Promise<Wallet> {
  let pair = await idb<KeyPair | undefined>('readonly', (s) => s.get(BROWSER_KEY))
  if (!pair) {
    pair = await WebCryptoP256.createKeyPair()
    await idb('readwrite', (s) => s.put(pair, BROWSER_KEY))
  }
  return asWallet('browser', Account.fromWebCryptoP256(pair))
}

export const storedPasskey = (): StoredPasskey | null => {
  try {
    return JSON.parse(localStorage.getItem(PASSKEY) ?? 'null') as StoredPasskey | null
  } catch {
    return null
  }
}

/** A passkey root: reuse the stored credential, or create one and persist its id and public key. */
export async function passkeyWallet(): Promise<Wallet> {
  let cred = storedPasskey()
  if (!cred) {
    const created = await WebAuthnP256.createCredential({ label: 'STANDING membership' })
    cred = { id: created.id, publicKey: created.publicKey }
    localStorage.setItem(PASSKEY, JSON.stringify(cred))
  }
  return asWallet('passkey', Account.fromWebAuthnP256(cred) as never)
}

export async function restoreWallet(): Promise<Wallet | null> {
  const last = localStorage.getItem('standing.wallet')
  try {
    if (last === 'passkey' && storedPasskey()) return await passkeyWallet()
    if (last === 'browser' && (await hasBrowserKey())) return await browserWallet()
  } catch {
    return null
  }
  return null
}

export const rememberWallet = (k: WalletKind | null) => (k ? localStorage.setItem('standing.wallet', k) : localStorage.removeItem('standing.wallet'))

const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const

export async function balances(address: Address) {
  const pub = publicClient()
  const [pathUsd, fee] = await Promise.all([
    pub.readContract({ address: PATH_USD, abi: erc20, functionName: 'balanceOf', args: [address] }),
    pub.readContract({ address: FEE_TOKEN, abi: erc20, functionName: 'balanceOf', args: [address] }),
  ])
  return { pathUsd, fee }
}

/** Moderato faucet, then poll both balances until they cover the first period and gas. Rejects after `timeoutMs`. */
export async function fund(address: Address, need: bigint, onTick?: (b: { pathUsd: bigint; fee: bigint }) => void, timeoutMs = 60_000) {
  await createClient({ chain, transport: http() }).request({ method: 'tempo_fundAddress', params: [address] } as never)
  const gas = toUnits('1')
  const t0 = Date.now()
  for (;;) {
    const b = await balances(address)
    onTick?.(b)
    if (b.pathUsd >= need && b.fee >= gas) return b
    if (Date.now() - t0 > timeoutMs) throw new Error('The faucet did not credit this key within 60 seconds.')
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/** One signature, one Tempo transaction carrying every call. Resolves once the receipt shows success. */
export async function sendCalls(w: Wallet, calls: Call[]) {
  const client = createClient({ account: w.account, chain, transport: http() }).extend(publicActions).extend(walletActions)
  const tx = await client.sendTransaction({ calls } as never)
  const receipt = await client.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  if (receipt.status !== 'success') throw new Error('The transaction was included and reverted.')
  return { tx, block: receipt.blockNumber }
}

/** Drops the stored browser key so the next `browserWallet()` mints a fresh one. */
export async function discardBrowserKey() {
  await idb('readwrite', (s) => s.delete(BROWSER_KEY))
}
