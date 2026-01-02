import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { BitcoinWalletConnector } from "./BitcoinWalletConnector"
import {
  WalletAdapter,
  WalletAdapterAddress,
  WalletAdapterFactory,
} from "./WalletAdapters.types"

export interface WalletSession {
  adapterId: string
  adapter: WalletAdapter
  addresses: WalletAdapterAddress[]
}

export interface BitcoinConnectionContextValue {
  // Core connection state
  walletSession: null | WalletSession
  isConnectionInitializing: boolean
  connect: (adapterId: string, adapter: WalletAdapter) => Promise<void>
  disconnect: () => Promise<void>

  // Wallet management (for UI)
  adapterFactories: WalletAdapterFactory<WalletAdapter>[]
  availableAdapters: (readonly [adapterId: string, adapter: WalletAdapter])[]
}

const BitcoinConnectionContext =
  createContext<null | BitcoinConnectionContextValue>(null)

function useConnectorState<T>(
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void },
  getSnapshot: () => T,
  deps: ReadonlyArray<unknown>,
): T {
  const [value, setValue] = useState(getSnapshot)

  useEffect(() => {
    const subscription = subscribe(setValue)
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return value
}

export const BitcoinConnectionProvider: FC<{
  children: ReactNode
  adapterFactories: WalletAdapterFactory<WalletAdapter>[]
  onWalletConnected?: (session: WalletSession) => void
  onWalletAddressesChanged?: (addresses: WalletAdapterAddress[]) => void
  onWalletDisconnected?: () => void
}> = props => {
  const [isConnectionInitializing, setIsConnectionInitializing] =
    useState(false)
  const [walletSession, setWalletSession] = useState<null | WalletSession>(null)

  const onWalletConnected = usePersistFn(props.onWalletConnected ?? noop)
  const onWalletAddressesChanged = usePersistFn(
    props.onWalletAddressesChanged ?? noop,
  )
  const onWalletDisconnected = usePersistFn(props.onWalletDisconnected ?? noop)

  const connector = useMemo(
    () => new BitcoinWalletConnector(props.adapterFactories),
    [props.adapterFactories],
  )

  useEffect(
    () => () => {
      connector.dispose()
    },
    [connector],
  )

  const availableAdapters = useConnectorState(
    listener => connector.subscribeAvailableAdapters(listener),
    () => connector.getAvailableAdapters(),
    [connector],
  )

  const connectInfo = useConnectorState(
    listener => connector.subscribeConnectedInfo(listener),
    () => connector.getConnectedInfo(),
    [connector],
  )

  const ctxValue = useMemo(
    (): BitcoinConnectionContextValue => ({
      walletSession,
      isConnectionInitializing,
      connect: connector.connect.bind(connector),
      disconnect: connector.disconnect.bind(connector),

      adapterFactories: props.adapterFactories,
      availableAdapters,
    }),
    [
      walletSession,
      isConnectionInitializing,
      connector,
      props.adapterFactories,
      availableAdapters,
    ],
  )

  useEffect(() => {
    const abortController = new AbortController()

    const sub = connector.subscribeConnectedInfo(info => {
      if (info == null) {
        try {
          onWalletDisconnected()
        } catch (e) {
          console.error(
            "[BitcoinConnectionProvider] onWalletDisconnected error",
            e,
          )
        }

        setWalletSession(null)
        setIsConnectionInitializing(false)
        return
      }

      setIsConnectionInitializing(true)
      info.adapter
        .getAddresses()
        .then(addresses => {
          if (abortController.signal.aborted) return

          const walletSession: WalletSession = {
            adapterId: info.adapterId,
            adapter: info.adapter,
            addresses,
          }

          try {
            onWalletConnected(walletSession)
          } catch (e) {
            console.error(
              "[BitcoinConnectionProvider] onWalletConnected error",
              e,
            )
          }

          setWalletSession(walletSession)
          setIsConnectionInitializing(false)
        })
        .catch(err => {
          if (abortController.signal.aborted) return
          setIsConnectionInitializing(false)
          console.error("[BitcoinConnectionProvider] connect error", err)
        })
    })

    return () => {
      abortController.abort()
      sub.unsubscribe()
    }
  }, [connector, onWalletDisconnected, onWalletConnected])

  // Listen to address changes from wallet
  useEffect(() => {
    if (connectInfo == null) return

    const abortController = new AbortController()

    const sub = connectInfo.adapter.onAddressesChanged(({ addresses }) => {
      if (abortController.signal.aborted) return

      setWalletSession(prev => {
        if (prev == null) {
          console.warn(
            "[BitcoinConnectionProvider] onWalletAddressesChanged event received while disconnected, skipping...",
          )
          return prev
        }

        try {
          onWalletAddressesChanged(addresses)
        } catch (e) {
          console.error(
            "[BitcoinConnectionProvider] onWalletAddressesChanged error",
            e,
          )
        }

        return { ...prev, addresses }
      })
    })
    return () => {
      abortController.abort()
      sub.unsubscribe()
    }
  }, [connectInfo, onWalletAddressesChanged])

  return (
    <BitcoinConnectionContext.Provider value={ctxValue}>
      {props.children}
    </BitcoinConnectionContext.Provider>
  )
}

export function useBitcoinConnectionContext(): BitcoinConnectionContextValue {
  const ctx = useContext(BitcoinConnectionContext)
  if (!ctx) {
    throw new Error(
      "useBitcoinConnectionContext must be used within BitcoinConnectionProvider",
    )
  }

  return ctx
}

const noop = (): void => {}

const usePersistFn = <T extends (...args: any[]) => any>(
  fn: T,
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const fnRef = useRef(fn)
  fnRef.current = fn

  return useCallback((...args) => fnRef.current(...args), [])
}
