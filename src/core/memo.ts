import { bytesToHex, hexToBytes, type Hex } from 'viem'
import { ROLES, type Role } from './plan'

const MAGIC = [0x53, 0x54, 0x4e, 0x44] // "STND"
const VERSION = 1

export type Memo = { planId: string; role: Role; periodEnd: number }

/** 32-byte memo: "STND" | version | role | plan id (4 bytes) | period end, unix seconds (8 bytes) | zero pad. */
export function encodeMemo(m: Memo): Hex {
  const b = new Uint8Array(32)
  b.set(MAGIC, 0)
  b[4] = VERSION
  b[5] = ROLES.indexOf(m.role) + 1
  if (b[5] === 0) throw new Error(`unknown role ${m.role}`)
  b.set(hexToBytes(`0x${m.planId}`, { size: 4 }), 6)
  new DataView(b.buffer).setBigUint64(10, BigInt(m.periodEnd))
  return bytesToHex(b)
}

export function decodeMemo(memo: Hex): Memo | null {
  const b = hexToBytes(memo)
  if (b.length !== 32 || MAGIC.some((x, i) => b[i] !== x) || b[4] !== VERSION) return null
  const role = ROLES[b[5] - 1]
  if (!role) return null
  const planId = bytesToHex(b.slice(6, 10)).slice(2)
  const periodEnd = Number(new DataView(b.buffer, b.byteOffset).getBigUint64(10))
  return { planId, role, periodEnd }
}
