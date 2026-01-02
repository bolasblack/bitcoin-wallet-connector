import { base64, hex } from "@scure/base"
import * as btc from "@scure/btc-signer"
import { UserRejectError } from "../utils/error"
import {
  SignMessageAlgorithm,
  SignMessageResult,
  WalletAdapter,
  WalletAdapter_onAddressesChanged_callback,
  WalletAdapterAddress,
  WalletAdapterAddressPurpose,
  WalletAdapterBitcoinNetwork,
  WalletAdapterNotConnectedError,
} from "../WalletAdapters.types"
import {
  XverseCompatibleProviderError,
  XverseRpcErrorCode,
} from "./XverseCompatibleWalletAdapterImpl"

type GetAddressResponse = import("sats-connect").GetAddressResponse

export type XverseCompatibleWalletAdapterGetProviderFn = () => Promise<
  import("sats-connect").BitcoinProvider
>

export type XverseCompatibleWalletAdapterParsedAddressesFn = (info: {
  sdk: typeof import("sats-connect")
  addresses: import("sats-connect").Address[]
}) => Promise<XverseCompatibleWalletAdapterImplAddress[]>

export type XverseCompatibleWalletAdapterImplAddress = WalletAdapterAddress & {
  publicKey: string
}

export class XverseCompatibleWalletAdapterImpl_legacy implements WalletAdapter {
  protected readonly network: WalletAdapterBitcoinNetwork
  protected readonly localStorageKey: string
  protected readonly walletDisplayName: string
  protected readonly getProvider: XverseCompatibleWalletAdapterGetProviderFn
  protected readonly parseAddresses: XverseCompatibleWalletAdapterParsedAddressesFn

  constructor(info: {
    network: WalletAdapterBitcoinNetwork
    localStorageKey: string
    walletDisplayName: string
    getProvider: XverseCompatibleWalletAdapterGetProviderFn
    parseAddresses: XverseCompatibleWalletAdapterParsedAddressesFn
  }) {
    this.network = info.network
    this.localStorageKey = info.localStorageKey
    this.walletDisplayName = info.walletDisplayName
    this.getProvider = info.getProvider
    this.parseAddresses = info.parseAddresses
  }

  private async getSdk(): Promise<typeof import("sats-connect")> {
    return import("sats-connect")
  }

  protected retrieveConnectedAddress(): GetAddressResponse | undefined {
    let resp: GetAddressResponse | undefined
    const stored = localStorage.getItem(this.localStorageKey) || undefined
    if (stored != null) {
      try {
        resp = JSON.parse(stored)
        if (
          resp == null ||
          !("addresses" in resp) ||
          !Array.isArray(resp.addresses)
        ) {
          throw new Error("Invalid stored addresses")
        }
      } catch {
        localStorage.removeItem(this.localStorageKey)
      }
    }
    return resp
  }
  protected async updateConnectedAddress(
    addresses: GetAddressResponse["addresses"],
  ): Promise<void> {
    localStorage.setItem(this.localStorageKey, JSON.stringify({ addresses }))
  }

  async connect(): Promise<void> {
    if (this.retrieveConnectedAddress() == null) {
      const resp = await this.connectImpl()
      await this.updateConnectedAddress(resp.addresses)
    }
  }
  private async connectImpl(): Promise<GetAddressResponse> {
    const sdk = await this.getSdk()

    const networkType =
      this.network === WalletAdapterBitcoinNetwork.MAINNET
        ? sdk.BitcoinNetworkType.Mainnet
        : sdk.BitcoinNetworkType.Testnet

    return new Promise<GetAddressResponse>((resolve, reject) => {
      void sdk
        .getAddress({
          getProvider: () => this.getProvider(),
          payload: {
            purposes: [sdk.AddressPurpose.Ordinals, sdk.AddressPurpose.Payment],
            message: "Address for receiving Ordinals and payments",
            network: { type: networkType },
          },
          onFinish(resp) {
            resolve(resp)
          },
          onCancel() {
            reject(new UserRejectError())
          },
        })
        .catch(reject)
    })
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem(this.localStorageKey)
    return Promise.resolve()
  }

  async getAddresses(): Promise<XverseCompatibleWalletAdapterImplAddress[]> {
    const resp = this.retrieveConnectedAddress()

    if (resp == null) {
      throw new WalletAdapterNotConnectedError(this.walletDisplayName)
    }

    const sdk = await this.getSdk()

    return this.parseAddresses({ sdk, addresses: resp.addresses })
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    const sdk = await this.getSdk()

    return new Promise((resolve, reject) => {
      /**
       * https://docs.xverse.app/sats-connect/methods/signmessage
       */
      void sdk.signMessage({
        getProvider: () => this.getProvider(),
        payload: {
          network: {
            type:
              this.network === "mainnet"
                ? sdk.BitcoinNetworkType.Mainnet
                : sdk.BitcoinNetworkType.Testnet,
          },
          address,
          message,
          protocol: sdk.MessageSigningProtocols.BIP322,
        },
        onFinish(resp) {
          resolve({
            result: resp,
            address,
            algorithm: SignMessageAlgorithm.BIP322,
          })
        },
        onCancel() {
          reject(new UserRejectError())
        },
      })
    })
  }

  sendBitcoinFeeRateCapability = "unavailable" as const
  async sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
  ): Promise<{ txid: string }> {
    const senderAddress = (await this.getAddresses()).find(a =>
      a.purposes.includes(WalletAdapterAddressPurpose.Bitcoin),
    )
    if (senderAddress == null) {
      throw new XverseCompatibleProviderError({
        code: XverseRpcErrorCode.INVALID_PARAMS,
        message: "Bitcoin address not found",
      })
    }

    const sdk = await this.getSdk()

    return new Promise((resolve, reject) => {
      void sdk
        .sendBtcTransaction({
          getProvider: () => this.getProvider(),
          payload: {
            network: {
              type:
                this.network === WalletAdapterBitcoinNetwork.MAINNET
                  ? sdk.BitcoinNetworkType.Mainnet
                  : sdk.BitcoinNetworkType.Testnet,
            },
            message: "Send Bitcoin",
            recipients: [
              {
                address: receiverAddress,
                amountSats: BigInt(satoshiAmount),
              },
            ],
            senderAddress: senderAddress.address,
          },
          onFinish(resp) {
            return resolve({ txid: resp })
          },
          onCancel() {
            reject(new UserRejectError())
          },
        })
        .catch(reject)
    })
  }

  /**
   * @internal
   * @experimental
   */
  sendInscriptionFeeRateCapability = "unavailable" as const

  async signAndFinalizePsbt(
    psbtHex: string,
    signIndices: [address: string, signIndex: number][],
  ): Promise<{
    signedPsbtHex: string
  }> {
    const sdk = await this.getSdk()

    const psbtBase64 = base64.encode(hex.decode(psbtHex))

    const signedPsbt = await new Promise<Uint8Array>((resolve, reject) => {
      void sdk
        .signTransaction({
          getProvider: () => this.getProvider(),
          payload: {
            network: {
              type:
                this.network === WalletAdapterBitcoinNetwork.MAINNET
                  ? sdk.BitcoinNetworkType.Mainnet
                  : sdk.BitcoinNetworkType.Testnet,
            },
            message: "Sign transaction",
            psbtBase64,
            inputsToSign: signIndices.map(([address, signIndex]) => ({
              address,
              signingIndexes: [signIndex],
            })),
            broadcast: false,
          },
          onFinish(resp) {
            resolve(base64.decode(resp.psbtBase64))
          },
          onCancel() {
            reject(new UserRejectError())
          },
        })
        .catch(reject)
    })

    const tx = btc.Transaction.fromPSBT(signedPsbt, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
      disableScriptCheck: true,
      allowLegacyWitnessUtxo: true,
    })
    tx.finalize()

    return { signedPsbtHex: hex.encode(tx.toPSBT()) }
  }

  onAddressesChanged(callback: WalletAdapter_onAddressesChanged_callback): {
    unsubscribe: () => void
  } {
    throw new Error("Not implemented")
  }
}
