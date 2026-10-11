import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserWallet, discardBrowserKey, passkeyWallet, rememberWallet, restoreWallet, type Wallet, type WalletKind } from './lib/wallet'

type Ctx = {
  wallet: Wallet | null
  ready: boolean
  busy: WalletKind | null
  error: string | null
  connect: (kind: WalletKind) => Promise<Wallet | null>
  forget: () => void
  freshBrowserKey: () => Promise<Wallet | null>
}

const WalletCtx = createContext<Ctx | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<WalletKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    restoreWallet().then((w) => {
      setWallet(w)
      setReady(true)
    })
  }, [])

  const connect = useCallback(async (kind: WalletKind) => {
    setBusy(kind)
    setError(null)
    try {
      const w = kind === 'browser' ? await browserWallet() : await passkeyWallet()
      rememberWallet(kind)
      setWallet(w)
      return w
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(kind === 'passkey' ? `The passkey could not be used: ${msg.slice(0, 160)}. The browser key works on any device.` : `The browser key could not be created: ${msg.slice(0, 160)}`)
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  const forget = useCallback(() => {
    rememberWallet(null)
    setWallet(null)
  }, [])

  const freshBrowserKey = useCallback(async () => {
    await discardBrowserKey()
    return connect('browser')
  }, [connect])

  const value = useMemo(() => ({ wallet, ready, busy, error, connect, forget, freshBrowserKey }), [wallet, ready, busy, error, connect, forget, freshBrowserKey])
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export function useWallet() {
  const c = useContext(WalletCtx)
  if (!c) throw new Error('useWallet outside WalletProvider')
  return c
}
