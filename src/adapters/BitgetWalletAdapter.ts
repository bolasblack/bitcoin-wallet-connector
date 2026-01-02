import { createAvailability } from "../utils/createAdapterAvailability"
import type { UnisatCompatibleProviderAPI } from "../utils/UnisatCompatibleWalletAdapterImpl"
import type {
  WalletAdapter,
  WalletAdapterMetadata,
  WalletAdapterFactory,
} from "../WalletAdapters.types"

/**
 * Derivation path (BIP-44): m/44'/0'/0'/0/ address_index
 */

const adapterId = "bitget.bitcoin"

/**
 * https://web3.bitget.com/en/docs/wallet/brand-assets.html
 */
export const metadata: WalletAdapterMetadata = {
  name: "Bitget",
  iconUrl: () => import("../_/bitget.png").then(m => m.default),
  websiteUrl: "https://web3.bitget.com/",
  downloadUrl: "https://web3.bitget.com/en/wallet-download",
}

const availability = createAvailability<
  UnisatCompatibleProviderAPI,
  WalletAdapter
>({
  getPrecondition: () =>
    (window as any).bitkeep?.unisat == null
      ? null
      : { value: (window as any).bitkeep.unisat },
  initializer: async provider => {
    const { BitgetWalletAdapterImpl } =
      await import("./BitgetWalletAdapter.impl")
    return new BitgetWalletAdapterImpl(provider)
  },
})

export function BitgetWalletAdapterFactory(): WalletAdapterFactory<WalletAdapter> {
  return {
    adapterId,
    metadata,
    getAdapter: () => availability,
  }
}
