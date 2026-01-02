import { hex } from "@scure/base"
import { addressToScriptPubKey } from "../utils/bitcoinAddressHelpers"
import { getBitcoinNetwork } from "../utils/bitcoinNetworkHelpers"
import {
  XverseCompatibleWalletAdapterImpl_legacy,
  XverseCompatibleWalletAdapterImplAddress,
} from "../utils/XverseCompatibleWalletAdapterImpl_legacy"
import {
  WalletAdapter,
  WalletAdapter_onAddressesChanged_callback,
  WalletAdapterAddressPurpose,
  WalletAdapterAddressType,
  WalletAdapterBitcoinNetwork,
} from "../WalletAdapters.types"
import { MAGICEDEN_PROVIDER_ID, metadata } from "./MagicEdenWalletAdapter"
import { LOCAL_STORAGE_KEY_PREFIX } from "../constants"

interface MagicEdenBitcoinProviderEvents {
  accountsChanged: [
    event: {
      accounts: import("sats-connect").GetAddressResponse["addresses"]
    },
  ]
}

export interface MagicEdenBitcoinProvider {
  isMagicEden: boolean
  on: <K extends keyof MagicEdenBitcoinProviderEvents>(
    event: K,
    handler: (...args: MagicEdenBitcoinProviderEvents[K]) => void,
  ) => void
  removeListener: <K extends keyof MagicEdenBitcoinProviderEvents>(
    event: K,
    handler: (...args: MagicEdenBitcoinProviderEvents[K]) => void,
  ) => void
}

const localStorageKeyPrefix = `${LOCAL_STORAGE_KEY_PREFIX}:${MAGICEDEN_PROVIDER_ID}`

export class MagicEdenWalletAdapterImpl
  extends XverseCompatibleWalletAdapterImpl_legacy
  implements WalletAdapter
{
  private magicEden: MagicEdenBitcoinProvider

  constructor(
    network: WalletAdapterBitcoinNetwork,
    provider: MagicEdenBitcoinProvider,
  ) {
    super({
      network,
      localStorageKeyPrefix,
      walletDisplayName: metadata.name,
      getProvider: async () => {
        return provider as any
      },
      parseAddresses: async ({ sdk, addresses }) => {
        const isMainnet = addresses
          .filter(a => a.purpose === sdk.AddressPurpose.Ordinals)[0]
          .address.startsWith("bc")

        return addresses.flatMap(
          (a): XverseCompatibleWalletAdapterImplAddress[] => {
            if (a.purpose === sdk.AddressPurpose.Payment) {
              return [
                {
                  addressType: WalletAdapterAddressType.P2WPKH,
                  purposes: [WalletAdapterAddressPurpose.Bitcoin],
                  address: a.address,
                  network: this.network,
                  scriptPubKey: hex.encode(
                    addressToScriptPubKey(
                      getBitcoinNetwork(isMainnet ? "mainnet" : "testnet"),
                      a.address,
                    ),
                  ),
                  publicKey: a.publicKey,
                },
              ]
            }

            if (a.purpose === sdk.AddressPurpose.Ordinals) {
              return [
                {
                  addressType: WalletAdapterAddressType.P2TR,
                  purposes: [
                    WalletAdapterAddressPurpose.Ordinals,
                    WalletAdapterAddressPurpose.BRC20,
                    WalletAdapterAddressPurpose.Runes,
                  ],
                  address: a.address,
                  network: this.network,
                  scriptPubKey: hex.encode(
                    addressToScriptPubKey(
                      getBitcoinNetwork(isMainnet ? "mainnet" : "testnet"),
                      a.address,
                    ),
                  ),
                  publicKey: a.publicKey,
                  tapInternalKey: a.publicKey,
                },
              ]
            }

            return []
          },
        )
      },
    })
    this.magicEden = provider
  }

  onAddressesChanged(callback: WalletAdapter_onAddressesChanged_callback): {
    unsubscribe: () => void
  } {
    // MagicEden uses accountsChanged event
    // https://docs-wallet.magiceden.io/bitcoin/provider-events
    const provider = this.magicEden

    const handler = async (event: {
      accounts: import("sats-connect").GetAddressResponse["addresses"]
    }): Promise<void> => {
      try {
        await this.updateConnectedAddress(event.accounts)
        const addresses = await this.getAddresses()
        callback({ addresses })
      } catch (error) {
        console.warn("[Magic Eden] Failed to get addresses on change:", error)
      }
    }

    provider.on("accountsChanged", handler)

    return {
      unsubscribe: () => {
        provider.removeListener("accountsChanged", handler)
      },
    }
  }
}
