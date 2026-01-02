import type {
  WalletAdapter,
  WalletAdapterFactory,
} from "../WalletAdapters.types"
import type { UnisatCompatibleProviderAPI } from "../utils/UnisatCompatibleWalletAdapterImpl"
import { createAvailability } from "../utils/createAdapterAvailability"

const adapterId = "okxwallet.bitcoin"

const metadata = {
  name: "OKX Wallet",
  iconUrl: () => import("../_/okx.png").then(m => m.default),
  websiteUrl: "https://web3.okx.com/",
  downloadUrl: "https://web3.okx.com/download",
}

const availability = createAvailability<
  UnisatCompatibleProviderAPI,
  WalletAdapter
>({
  getPrecondition: () => {
    const provider = (window as any).okxwallet?.bitcoin as
      | UnisatCompatibleProviderAPI
      | undefined
    return provider == null ? null : { value: provider }
  },
  initializer: async provider => {
    const { OkxWalletAdapterImpl } = await import("./OkxWalletAdapter.impl")
    return new OkxWalletAdapterImpl(provider as any)
  },
})

export function OkxWalletAdapterFactory(): WalletAdapterFactory<WalletAdapter> {
  return {
    adapterId,
    metadata,
    getAdapter: () => availability,
  }
}
