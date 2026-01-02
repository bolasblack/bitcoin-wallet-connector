import { hex } from "@scure/base"
import {
  addressToScriptPubKey,
  getRedeemScriptOf_P2SH_P2WPKH_publicKey,
} from "../utils/bitcoinAddressHelpers"
import { getBitcoinNetwork } from "../utils/bitcoinNetworkHelpers"
import { checkNever } from "../utils/misc"
import {
  XverseCompatibleWalletAdapterImpl,
  XverseCompatibleWalletAdapterImplAddress,
} from "../utils/XverseCompatibleWalletAdapterImpl"
import {
  WalletAdapter,
  WalletAdapterAddressPurpose,
  WalletAdapterAddressType,
  WalletAdapterBitcoinNetwork,
} from "../WalletAdapters.types"
import { metadata, XVERSE_PROVIDER_ID } from "./XverseWalletAdapter"

declare global {
  interface Window {
    btc_providers?: import("sats-connect").Provider[]
  }
}

export type XverseWalletAdapterAddresses =
  XverseCompatibleWalletAdapterImplAddress

/**
 * Derivation path (BIP-49): m/49'/0'/0'/0/ address_index
 */

export class XverseWalletAdapterImpl
  extends XverseCompatibleWalletAdapterImpl
  implements WalletAdapter
{
  constructor() {
    super({
      walletDisplayName: metadata.name,
      getProviderId: async () => {
        return XVERSE_PROVIDER_ID
      },
      parseAddresses: async ({ sdk, network: xverseNetwork, addresses }) => {
        // prettier-ignore
        const network =
          xverseNetwork === sdk.BitcoinNetworkType.Mainnet ? WalletAdapterBitcoinNetwork.MAINNET :
          xverseNetwork === sdk.BitcoinNetworkType.Testnet ? WalletAdapterBitcoinNetwork.TESTNET :
          xverseNetwork === sdk.BitcoinNetworkType.Testnet4 ? WalletAdapterBitcoinNetwork.TESTNET :
          xverseNetwork === sdk.BitcoinNetworkType.Signet ? WalletAdapterBitcoinNetwork.UNKNOWN :
          xverseNetwork === sdk.BitcoinNetworkType.Regtest ? WalletAdapterBitcoinNetwork.UNKNOWN :
          (checkNever(xverseNetwork), WalletAdapterBitcoinNetwork.UNKNOWN)

        const bitcoinNetwork = getBitcoinNetwork(
          network === WalletAdapterBitcoinNetwork.MAINNET
            ? "mainnet"
            : "testnet",
        )

        return addresses.flatMap((a): XverseWalletAdapterAddresses[] => {
          const purposes: WalletAdapterAddressPurpose[] = []
          switch (a.purpose) {
            case sdk.AddressPurpose.Ordinals:
              purposes.push(
                WalletAdapterAddressPurpose.Ordinals,
                WalletAdapterAddressPurpose.BRC20,
                WalletAdapterAddressPurpose.Runes,
              )
              break
            case sdk.AddressPurpose.Payment:
              purposes.push(WalletAdapterAddressPurpose.Bitcoin)
              break
          }

          const scriptPubKey = hex.encode(
            addressToScriptPubKey(bitcoinNetwork, a.address),
          )

          switch (a.addressType) {
            case sdk.AddressType.stacks:
              return []
            case sdk.AddressType.p2pkh:
              return [
                {
                  purposes,
                  network,
                  addressType: WalletAdapterAddressType.P2PKH,
                  address: a.address,
                  scriptPubKey,
                  publicKey: a.publicKey,
                },
              ]
            case sdk.AddressType.p2wpkh:
              return [
                {
                  purposes,
                  network,
                  addressType: WalletAdapterAddressType.P2WPKH,
                  address: a.address,
                  scriptPubKey,
                  publicKey: a.publicKey,
                },
              ]
            case sdk.AddressType.p2tr: {
              const tapInternalKey: string = a.publicKey
              return [
                {
                  purposes,
                  network,
                  addressType: WalletAdapterAddressType.P2TR,
                  address: a.address,
                  scriptPubKey,
                  publicKey: a.publicKey,
                  tapInternalKey,
                },
              ]
            }
            case sdk.AddressType.p2sh: {
              const redeemScript = hex.encode(
                getRedeemScriptOf_P2SH_P2WPKH_publicKey(
                  bitcoinNetwork,
                  hex.decode(a.publicKey),
                ),
              )
              return [
                {
                  purposes,
                  network,
                  addressType: WalletAdapterAddressType.P2SH_P2WPKH,
                  address: a.address,
                  scriptPubKey,
                  publicKey: a.publicKey,
                  redeemScript,
                },
              ]
            }
            case sdk.AddressType.p2wsh:
              // not supported
              return []
            case sdk.AddressType.starknet:
            case sdk.AddressType.spark:
              return []
            default:
              checkNever(a.addressType)
              return []
          }
        })
      },
    })
  }
}
