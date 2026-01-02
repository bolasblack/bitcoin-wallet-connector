import {
  UnisatCompatibleProviderAPI,
  UnisatCompatibleWalletAdapterImpl,
} from "../utils/UnisatCompatibleWalletAdapterImpl"
import { WalletAdapter } from "../WalletAdapters.types"

/**
 * Derivation path (BIP-44): m/44'/0'/0'/0/ address_index
 */
export class BitgetWalletAdapterImpl
  extends UnisatCompatibleWalletAdapterImpl
  implements WalletAdapter
{
  constructor(provider: UnisatCompatibleProviderAPI) {
    /**
     * Bitget Provider API:
     *
     * https://web3.bitget.com/zh-CN/docs/provider-api/btc.html
     */
    super(provider, "Bitget")
  }
}
