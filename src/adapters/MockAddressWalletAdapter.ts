import { hex } from "@scure/base"
import { Script } from "@scure/btc-signer"
import {
  addressToScriptPubKeyHex,
  getAddressType,
} from "../utils/bitcoinAddressHelpers"
import {
  BitcoinNetwork,
  getBitcoinNetwork,
  isMainnet,
} from "../utils/bitcoinNetworkHelpers"
import { BitcoinWalletAdapterError } from "../utils/error"
import { checkNever } from "../utils/misc"
import {
  SignMessageResult,
  WalletAdapter,
  WalletAdapter_onAddressesChanged_callback,
  WalletAdapterAddress,
  WalletAdapterAddressPurpose,
  WalletAdapterAddressType,
  WalletAdapterBitcoinNetwork,
  WalletAdapterFactory,
  WalletAdapterSendBitcoinCapability,
} from "../WalletAdapters.types"

const randomTapInternalKey =
  "0000000000000000000000000000000000000000000000000000000000000000"

const randomPublicKey =
  "0000000000000000000000000000000000000000000000000000000000000000"

const randomRedeemScript = hex.encode(
  Script.encode(["OP_1", hex.decode(randomPublicKey), "OP_1", "CHECKMULTISIG"]),
)

export const MockAddressWalletAdapterFactory = (
  network: WalletAdapterBitcoinNetwork,
  mockedAdapter: WalletAdapterFactory<WalletAdapter>,
  mockedAddresses: Partial<{
    bitcoin: Partial<WalletAdapterAddress> & { address: string }
    ordinals: Partial<WalletAdapterAddress> & { address: string }
  }>,
): WalletAdapterFactory<WalletAdapter> => {
  return {
    adapterId: `mocked.${mockedAdapter.adapterId}`,
    metadata: {
      ...mockedAdapter.metadata,
      name: `Mocked ${mockedAdapter.metadata.name}`,
    },
    getAdapter() {
      const availability = mockedAdapter.getAdapter()

      return {
        subscribe(listener) {
          return availability.subscribe(adapter => {
            listener(
              new MockAddressWalletAdapter(network, adapter, mockedAddresses),
            )
          })
        },
      }
    },
  }
}

class MockAddressWalletAdapter implements WalletAdapter {
  private network: BitcoinNetwork

  constructor(
    network: WalletAdapterBitcoinNetwork,
    private inner: WalletAdapter,
    private addresses: Partial<{
      bitcoin: Partial<WalletAdapterAddress> & { address: string }
      ordinals: Partial<WalletAdapterAddress> & { address: string }
    }>,
  ) {
    this.network =
      network === WalletAdapterBitcoinNetwork.TESTNET
        ? getBitcoinNetwork("testnet")
        : getBitcoinNetwork("mainnet")
  }

  async connect(): Promise<void> {
    await this.inner.connect()
  }

  async disconnect(): Promise<void> {
    await this.inner.disconnect()
  }

  async getAddresses(): Promise<WalletAdapterAddress[]> {
    const addresses = await this.inner.getAddresses()

    const getWalletAdapterAddress = (
      addressName: string,
      info: {
        address: string
        purposes: WalletAdapterAddressPurpose[]
      },
    ): WalletAdapterAddress => {
      const addrType = getAddressType(this.network, info.address)

      // prettier-ignore
      const addressType =
        addrType === "p2tr" ? WalletAdapterAddressType.P2TR :
        addrType === "p2sh" ? WalletAdapterAddressType.P2SH_P2WPKH :
        addrType === "p2wpkh" ? WalletAdapterAddressType.P2WPKH :
        addrType === 'p2pkh' ? WalletAdapterAddressType.P2PKH :
        addrType === 'p2wsh' ? undefined /* unsupported */ :
        addrType === 'unknown' ? undefined :
        (checkNever(addrType), undefined)

      if (addressType == null) {
        throw new BitcoinWalletAdapterError(
          `[MockAddressWalletAdapter] Please provide a supported ${addressName} address`,
        )
      }

      return {
        network: isMainnet(this.network)
          ? WalletAdapterBitcoinNetwork.MAINNET
          : WalletAdapterBitcoinNetwork.TESTNET,
        purposes: info.purposes,
        addressType,
        address: info.address,
        scriptPubKey: addressToScriptPubKeyHex(this.network, info.address),
        publicKey: randomPublicKey,
        redeemScript: randomRedeemScript,
        tapInternalKey: randomTapInternalKey,
      }
    }

    let bitcoinAddress: undefined | WalletAdapterAddress
    let ordinalsAddress: undefined | WalletAdapterAddress

    if (this.addresses.bitcoin != null) {
      bitcoinAddress = getWalletAdapterAddress("bitcoin", {
        ...this.addresses.bitcoin,
        purposes: [WalletAdapterAddressPurpose.Bitcoin],
      })
    }

    if (this.addresses.ordinals != null) {
      ordinalsAddress = getWalletAdapterAddress("ordinals", {
        ...this.addresses.ordinals,
        purposes: [
          WalletAdapterAddressPurpose.Ordinals,
          WalletAdapterAddressPurpose.BRC20,
          WalletAdapterAddressPurpose.Runes,
        ],
      })
    }

    return addresses.flatMap(a => {
      const result: WalletAdapterAddress[] = []
      let restPurposes = a.purposes

      if (
        bitcoinAddress != null &&
        restPurposes.includes(WalletAdapterAddressPurpose.Bitcoin)
      ) {
        result.push(bitcoinAddress)
        restPurposes = restPurposes.filter(
          p => p !== WalletAdapterAddressPurpose.Bitcoin,
        )
      }

      if (
        ordinalsAddress != null &&
        restPurposes.includes(WalletAdapterAddressPurpose.Ordinals)
      ) {
        result.push(ordinalsAddress)
        restPurposes = restPurposes.filter(
          p => p !== WalletAdapterAddressPurpose.Ordinals,
        )
      }

      if (restPurposes.length > 0) {
        result.push({ ...a, purposes: restPurposes })
      }

      return result
    })
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    throw new BitcoinWalletAdapterError(
      `[MockAddressWalletAdapter] it's a mock adapter, can't send inscription`,
    )
  }

  signAndFinalizePsbt(psbtHex: string): Promise<{ signedPsbtHex: string }> {
    throw new BitcoinWalletAdapterError(
      `[MockAddressWalletAdapter] it's a mock adapter, can't sign transaction`,
    )
  }

  onAddressesChanged(_callback: WalletAdapter_onAddressesChanged_callback): {
    unsubscribe: () => void
  } {
    // Mock adapter doesn't support address change events
    return {
      unsubscribe: () => {
        // No-op
      },
    }
  }

  get sendBitcoinFeeRateCapability(): WalletAdapterSendBitcoinCapability {
    return this.inner.sendBitcoinFeeRateCapability
  }

  sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
  ): Promise<{ txid: string }> {
    throw new BitcoinWalletAdapterError(
      `[MockAddressWalletAdapter] it's a mock adapter, can't send bitcoin`,
    )
  }
}
