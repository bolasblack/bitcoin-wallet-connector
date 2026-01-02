import { AvailabilitySubscription } from "./utils/createAdapterAvailability"
import { StateChannel, StateChannelListener } from "./utils/StateChannel"
import {
  WalletAdapter,
  WalletAdapterFactory,
  WalletAdapterNotConnectedError,
} from "./WalletAdapters.types"

const previousConnectWalletAdapterIdLocalStorageKey =
  "app:BitcoinWalletConnector:previousConnectWallet"

export interface ConnectInfo {
  adapterId: string
  adapter: WalletAdapter
}

export type AdapterEntry = readonly [string, WalletAdapter]

export class BitcoinWalletConnector {
  private availableAdaptersState = new StateChannel<AdapterEntry[]>([])
  private connectedInfoState = new StateChannel<null | ConnectInfo>(null)
  private autoConnectRunning = false
  private availabilitySubscriptions: AvailabilitySubscription[] = []
  private adapterOrder = new Map<string, number>()

  constructor(private factories: WalletAdapterFactory<WalletAdapter>[]) {
    this.adapterOrder = new Map(
      factories.map((factory, index) => [factory.adapterId, index]),
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
    this.availabilitySubscriptions = this.factories.map(factory => {
      return factory.getAdapter().subscribe(adapter => {
        this.addOrUpdateAvailableAdapter(factory.adapterId, adapter)
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

    await finalAdapter.connect()
    localStorage.setItem(
      previousConnectWalletAdapterIdLocalStorageKey,
      adapterId,
    )

    this.connectedInfoState.setValue({ adapterId, adapter: finalAdapter })
  }

  async disconnect(): Promise<void> {
    const info = this.connectedInfoState.getValue()
    if (info == null) return

    await info.adapter.disconnect()
    localStorage.removeItem(previousConnectWalletAdapterIdLocalStorageKey)

    this.connectedInfoState.setValue(null)
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

    if (this.factories.some(factory => factory.adapterId === adapterId)) {
      return adapterId
    }
    return undefined
  }

  private get isConnected(): boolean {
    return this.connectedInfoState.getValue() != null
  }
}
