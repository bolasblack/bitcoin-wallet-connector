import { createAvailability } from "../utils/createAdapterAvailability"
import type { UnisatCompatibleProviderAPI } from "../utils/UnisatCompatibleWalletAdapterImpl"
import type {
  WalletAdapter,
  WalletAdapterMetadata,
  WalletAdapterFactory,
} from "../WalletAdapters.types"

/**
 * Derivation path (Native SegWit) (BIP-84): m/84'/0'/0'/0/address_index
 * Derivation path (Nested SegWit) (BIP-49): m/49'/0'/0'/0/address_index
 * Derivation path (Taproot) (BIP-86): m/86'/0'/0'/0/address_index
 * Derivation path (Taproot) (BIP-44): m/44'/0'/0'/0/address_index
 * Derivation path (Legacy) (BIP-44): m/44'/0'/0'/0/address_index
 */

const adapterId = "unisat"

const metadata: WalletAdapterMetadata = {
  name: "UniSat",
  /**
   * https://next-cdn.unisat.io/_/2025-v965/UniSat%20Logo.zip
   */
  iconUrl: () => import("../_/unisat.svg").then(m => m.default),
  websiteUrl: "https://unisat.io/",
  downloadUrl: "https://unisat.io/download",
}

const availability = createAvailability<
  UnisatCompatibleProviderAPI,
  WalletAdapter
>({
  getPrecondition: () => {
    const provider = (window as any).unisat as
      | UnisatCompatibleProviderAPI
      | undefined
    return provider == null ? null : { value: provider }
  },
  initializer: async provider => {
    const { UnisatWalletAdapterImpl } =
      await import("./UnisatWalletAdapter.impl")
    return new UnisatWalletAdapterImpl(provider)
  },
})

export function UnisatWalletAdapterFactory(): WalletAdapterFactory<WalletAdapter> {
  return {
    adapterId,
    metadata,
    getAdapter: () => availability,
  }
}
