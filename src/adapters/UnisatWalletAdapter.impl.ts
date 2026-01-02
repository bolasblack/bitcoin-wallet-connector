import {
  UnisatCompatibleProviderAPI,
  UnisatCompatibleWalletAdapterImpl,
} from "../utils/UnisatCompatibleWalletAdapterImpl"
import { WalletAdapter } from "../WalletAdapters.types"

/**
 * Derivation path (Native SegWit) (BIP-84): m/84'/0'/0'/0/address_index
 * Derivation path (Nested SegWit) (BIP-49): m/49'/0'/0'/0/address_index
 * Derivation path (Taproot) (BIP-86): m/86'/0'/0'/0/address_index
 * Derivation path (Taproot) (BIP-44): m/44'/0'/0'/0/address_index
 * Derivation path (Legacy) (BIP-44): m/44'/0'/0'/0/address_index
 */
export class UnisatWalletAdapterImpl
  extends UnisatCompatibleWalletAdapterImpl
  implements WalletAdapter
{
  constructor(provider: UnisatCompatibleProviderAPI) {
    /**
     * UniSat Provider API:
     *
     * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet
     */
    super(provider, "UniSat")
  }

  sendBitcoinFeeRateCapability = "required" as const

  // The default fee rate of unisat is not aligned with mempool.space, so
  // sometimes the tx will be rejected by mempool due to uneligible network fee.
  sendInscriptionFeeRateCapability = "unavailable" as const
}
