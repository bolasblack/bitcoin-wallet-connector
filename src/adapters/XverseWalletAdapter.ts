import type {
  WalletAdapter,
  WalletAdapterFactory,
  WalletAdapterMetadata,
} from "../WalletAdapters.types"
import { createAvailability } from "../utils/createAdapterAvailability"

export const XVERSE_PROVIDER_ID = "XverseProviders.BitcoinProvider"

export const metadata: WalletAdapterMetadata = {
  name: "Xverse",
  iconUrl: () => import("../_/xverse.png").then(m => m.default),
  websiteUrl: "https://xverse.app/",
  downloadUrl: "https://www.xverse.app/download",
}

const availability = createAvailability<
  import("sats-connect").Provider,
  WalletAdapter
>({
  getPrecondition: () => {
    const provider = (window.btc_providers ?? []).find(
      p => p.id === XVERSE_PROVIDER_ID,
    )
    return provider == null ? null : { value: provider }
  },
  initializer: async () => {
    const { XverseWalletAdapterImpl } =
      await import("./XverseWalletAdapter.impl")
    return new XverseWalletAdapterImpl()
  },
})

export function XverseWalletAdapterFactory(): WalletAdapterFactory<WalletAdapter> {
  return {
    adapterId: XVERSE_PROVIDER_ID,
    metadata,
    getAdapter: () => availability,
  }
}
