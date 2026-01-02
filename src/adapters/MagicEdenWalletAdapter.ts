import type {
  WalletAdapter,
  WalletAdapterBitcoinNetwork,
  WalletAdapterFactory,
} from "../WalletAdapters.types"
import { createAvailability } from "../utils/createAdapterAvailability"
import type { MagicEdenBitcoinProvider } from "./MagicEdenWalletAdapter.impl"

declare global {
  interface Window {
    magicEden?: {
      bitcoin?: MagicEdenBitcoinProvider
    }
  }
}

export const MAGICEDEN_PROVIDER_ID = "magiceden.bitcoin"

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const buildAvailability = (network: WalletAdapterBitcoinNetwork) =>
  createAvailability<MagicEdenBitcoinProvider, WalletAdapter>({
    getPrecondition: () => {
      const provider = window.magicEden?.bitcoin
      return provider?.isMagicEden ? { value: provider } : null
    },
    initializer: async provider => {
      const { MagicEdenWalletAdapterImpl } =
        await import("./MagicEdenWalletAdapter.impl")
      return new MagicEdenWalletAdapterImpl(network, provider)
    },
  })

export const MagicEdenWalletAdapterFactory = (options: {
  network: WalletAdapterBitcoinNetwork
}): WalletAdapterFactory<WalletAdapter> => {
  const availability = buildAvailability(options.network)

  return {
    adapterId: MAGICEDEN_PROVIDER_ID,
    /**
     * https://docs-wallet.magiceden.io/resources/logos-and-brand-assets
     */
    metadata: {
      name: "Magic Eden",
      iconUrl: () => import("../_/magiceden.png").then(m => m.default),
      websiteUrl: "https://wallet.magiceden.io/",
      downloadUrl: "https://wallet.magiceden.io/download",
    },
    getAdapter: () => availability,
  }
}
