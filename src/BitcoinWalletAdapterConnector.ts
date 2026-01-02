import { AvailabilitySubscription } from "./utils/createAdapterAvailability"
import { BitcoinWalletAdapterError } from "./utils/error"
import { StateChannel, StateChannelListener } from "./utils/StateChannel"
import {
  WalletAdapter,
  WalletAdapterNotConnectedError,
  WalletAdapterStatic,
} from "./WalletAdapters.types"

const previousConnectWalletAdapterIdLocalStorageKey =
  "app:BitcoinWalletAdapterConnector:previousConnectWallet"

export interface ConnectInfo {
  adapterId: string
  adapter: WalletAdapter
}

export type AdapterEntry = readonly [string, WalletAdapter]

export class BitcoinWalletAdapterConnector {
  private availableAdaptersState = new StateChannel<AdapterEntry[]>([])
  private connectedInfoState = new StateChannel<null | ConnectInfo>(null)
  private autoConnectRunning = false
  private availabilitySubscriptions: AvailabilitySubscription[] = []
  private adapterOrder = new Map<string, number>()

  constructor(private Adapters: WalletAdapterStatic<WalletAdapter>[]) {
    this.adapterOrder = new Map(
      Adapters.map((adapter, index) => [adapter.adapterId, index]),
    )
    this.initializeAdapterAvailability()
  }

  dispose(): void {
    this.availabilitySubscriptions.forEach(s => s.unsubscribe())
    this.availabilitySubscriptions = []
    this.availableAdaptersState = new StateChannel<AdapterEntry[]>([])
    this.connectedInfoState = new StateChannel<null | ConnectInfo>(null)
  }

  subscribeAvailableAdapters(
    listener: StateChannelListener<AdapterEntry[]>,
  ): AvailabilitySubscription {
    return this.availableAdaptersState.subscribe(listener)
  }
  getAvailableAdapters(): AdapterEntry[] {
    return this.availableAdaptersState.getValue()
  }

  subscribeConnectedInfo(
    listener: StateChannelListener<null | ConnectInfo>,
  ): AvailabilitySubscription {
    return this.connectedInfoState.subscribe(listener)
  }
  getConnectedInfo(): null | ConnectInfo {
    return this.connectedInfoState.getValue()
  }

  private initializeAdapterAvailability(): void {
    this.availabilitySubscriptions = this.Adapters.map(Adapter => {
      return Adapter.getAdapter().subscribe(adapter => {
        this.addOrUpdateAvailableAdapter(Adapter.adapterId, adapter)
      })
    })
  }

  private addOrUpdateAvailableAdapter(
    adapterId: string,
    adapter: WalletAdapter,
  ): void {
    this.availableAdaptersState.update(current => {
      const next = [...current]
      const existingIndex = current.findIndex(([id]) => id === adapterId)
      if (existingIndex === -1) {
        next.push([adapterId, adapter] as const)
      } else {
        next[existingIndex] = [adapterId, adapter] as const
      }

      next.sort(
        (a, b) =>
          (this.adapterOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
          (this.adapterOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
      )
      return next
    })

    void this.autoConnect()
  }

  async connect(adapterId: string, adapter: WalletAdapter): Promise<void> {
    const finalAdapter = adapter

    await finalAdapter.connect().catch(err => {
      if (err instanceof BitcoinWalletAdapterError) {
        alert(err.message)
        return
      }
      throw err
    })

    localStorage.setItem(
      previousConnectWalletAdapterIdLocalStorageKey,
      adapterId,
    )

    this.connectedInfoState.setValue({ adapterId, adapter: finalAdapter })
  }

  async disconnect(): Promise<void> {
    const info = this.connectedInfoState.getValue()
    if (info == null) return
    await this.disconnectAdapter(info.adapter)
    this.connectedInfoState.setValue(null)
  }
  private async disconnectAdapter(adapter: WalletAdapter): Promise<void> {
    await adapter.disconnect()
    localStorage.removeItem(previousConnectWalletAdapterIdLocalStorageKey)
  }

  private async autoConnect(): Promise<void> {
    if (this.isConnected || this.autoConnectRunning) return

    const previousAdapterId = this.previousConnectedWallet
    if (previousAdapterId == null) return

    const adapter = this.availableAdaptersState
      .getValue()
      .find(a => a[0] === previousAdapterId)?.[1]
    if (adapter == null) return

    this.autoConnectRunning = true
    try {
      await adapter.getAddresses()
    } catch (err: unknown) {
      if (err instanceof WalletAdapterNotConnectedError) {
        this.autoConnectRunning = false
        return
      }

      this.autoConnectRunning = false
      throw err
    }

    try {
      await this.connect(previousAdapterId, adapter)
    } finally {
      this.autoConnectRunning = false
    }
  }

  private get previousConnectedWallet(): string | undefined {
    const adapterId =
      localStorage.getItem(previousConnectWalletAdapterIdLocalStorageKey) ||
      undefined

    if (this.Adapters.some(adapter => adapter.adapterId === adapterId)) {
      return adapterId
    }
    return undefined
  }

  private get isConnected(): boolean {
    return this.connectedInfoState.getValue() != null
  }
}
