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
  WalletAdapterNotConnectedError,
} from "../WalletAdapters.types"

export type XverseCompatibleWalletAdapterGetProviderIdFn = () => Promise<string>

export type XverseCompatibleWalletAdapterParsedAddressesFn = (info: {
  sdk: typeof import("sats-connect")
  network: import("sats-connect").BitcoinNetworkType
  addresses: import("sats-connect").Address[]
}) => Promise<XverseCompatibleWalletAdapterImplAddress[]>

export type XverseCompatibleWalletAdapterImplAddress = WalletAdapterAddress & {
  publicKey: string
}

export class XverseCompatibleWalletAdapterImpl implements WalletAdapter {
  protected readonly walletDisplayName: string
  protected readonly getProviderId: XverseCompatibleWalletAdapterGetProviderIdFn
  protected readonly parseAddresses: XverseCompatibleWalletAdapterParsedAddressesFn

  constructor(info: {
    walletDisplayName: string
    getProviderId: XverseCompatibleWalletAdapterGetProviderIdFn
    parseAddresses: XverseCompatibleWalletAdapterParsedAddressesFn
  }) {
    this.walletDisplayName = info.walletDisplayName
    this.getProviderId = info.getProviderId
    this.parseAddresses = info.parseAddresses
  }

  private async getSdk(): Promise<typeof import("sats-connect")> {
    return import("sats-connect")
  }

  async connect(): Promise<void> {
    await (await this.getSdk()).request("wallet_connect", null)
  }

  async disconnect(): Promise<void> {
    return Promise.resolve()
  }

  async getAddresses(): Promise<XverseCompatibleWalletAdapterImplAddress[]> {
    const sdk = await this.getSdk()

    const resp = await handleRpcError(
      sdk.request(
        "getAddresses",
        {
          purposes: [sdk.AddressPurpose.Ordinals, sdk.AddressPurpose.Payment],
        },
        await this.getProviderId(),
      ),
    )

    if (resp == null) {
      throw new WalletAdapterNotConnectedError(this.walletDisplayName)
    }

    return this.parseAddresses({
      sdk,
      network: resp.network.bitcoin.name,
      addresses: resp.addresses,
    })
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    const sdk = await this.getSdk()

    const result = await handleRpcError(
      sdk.request(
        "signMessage",
        {
          address,
          message,
          protocol: sdk.MessageSigningProtocols.BIP322,
        },
        await this.getProviderId(),
      ),
    )

    return {
      result: result.signature,
      address,
      algorithm: SignMessageAlgorithm.BIP322,
    }
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

    return await handleRpcError(
      sdk.request(
        "sendTransfer",
        {
          recipients: [
            {
              address: receiverAddress,
              amount: Number(satoshiAmount),
            },
          ],
        },
        await this.getProviderId(),
      ),
    )
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

    const result = await handleRpcError(
      sdk.request(
        "signPsbt",
        {
          psbt: psbtBase64,
          signInputs: signIndices.reduce(
            (acc, [address, signIndex]) => {
              acc[address] = [signIndex]
              return acc
            },
            {} as Record<string, number[]>,
          ),
          broadcast: false,
        },
        await this.getProviderId(),
      ),
    )

    const tx = btc.Transaction.fromPSBT(base64.decode(result.psbt), {
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
    // Xverse uses sats-connect Wallet.addListener for events
    // https://docs.xverse.app/sats-connect/xverse-wallet-events
    const removeListeners: Array<() => void> = []

    void (async () => {
      const sdk = await this.getSdk()

      const handler = async (): Promise<void> => {
        try {
          const addresses = await this.getAddresses()
          callback({ addresses })
        } catch (error) {
          console.warn(
            `[${this.walletDisplayName}] Failed to get addresses on change:`,
            error,
          )
        }
      }

      // Listen to account and network changes
      const removeAccountListener = sdk.addListener("accountChange", handler)
      const removeNetworkListener = sdk.addListener("networkChange", handler)

      removeListeners.push(removeAccountListener, removeNetworkListener)
    })()

    return {
      unsubscribe: () => {
        removeListeners.forEach(remove => remove())
      },
    }
  }
}

export enum XverseRpcErrorCode {
  /**
   * Parse error Invalid JSON
   **/
  PARSE_ERROR = -32700,
  /**
   * The JSON sent is not a valid Request object.
   **/
  INVALID_REQUEST = -32600,
  /**
   * The method does not exist/is not available.
   **/
  METHOD_NOT_FOUND = -32601,
  /**
   * Invalid method parameter(s).
   */
  INVALID_PARAMS = -32602,
  /**
   * Internal JSON-RPC error.
   * This is a generic error, used when the server encounters an error in performing the request.
   **/
  INTERNAL_ERROR = -32603,
  /**
   * user rejected/canceled the request
   */
  USER_REJECTION = -32000,
  /**
   * method is not supported for the address provided
   */
  METHOD_NOT_SUPPORTED = -32001,
  /**
   * The client does not have permission to access the requested resource.
   */
  ACCESS_DENIED = -32002,
}
export interface XverseCompatibleProviderAPIThrownError {
  code: XverseRpcErrorCode
  message: string
}
export function isXverseCompatibleProviderAPIThrownError(
  err: any,
): err is XverseCompatibleProviderAPIThrownError {
  return err != null && "code" in err && "message" in err
}

export class XverseCompatibleProviderError extends Error {
  readonly code: number
  constructor(err: XverseCompatibleProviderAPIThrownError) {
    super(err.message)
    this.code = err.code
    this.cause = err
  }
}

const handleRpcError = async <T>(
  promise: Promise<
    { status: "success"; result: T } | { status: "error"; error: unknown }
  >,
): Promise<T> => {
  try {
    const res = await promise
    if (res.status === "error") {
      throw res.error
    }
    return res.result
  } catch (e: any) {
    if (isXverseCompatibleProviderAPIThrownError(e)) {
      if (e.code === XverseRpcErrorCode.USER_REJECTION) {
        throw new UserRejectError()
      }
      throw new XverseCompatibleProviderError(e)
    }
    throw e
  }
}
