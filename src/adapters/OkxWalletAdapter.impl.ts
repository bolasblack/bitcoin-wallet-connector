import { BitcoinWalletAdapterError, UserRejectError } from "../utils/error"
import {
  UniSatEvents,
  UnisatCompatibleProviderAPI,
  UnisatCompatibleWalletAdapterImpl,
} from "../utils/UnisatCompatibleWalletAdapterImpl"
import {
  SignMessageResult,
  WalletAdapter,
  WalletAdapter_onAddressesChanged_callback,
} from "../WalletAdapters.types"
import { metadata } from "./LeatherWalletAdapter"

enum RpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
  USER_REJECTION = 4001,
  METHOD_NOT_SUPPORTED = 4002,
}

interface RpcError<TErrorData = unknown> {
  code: number | RpcErrorCode
  message: string
  data?: TErrorData
}

interface OkxBitcoinProvider
  extends UnisatCompatibleProviderAPI, Record<string, any> {
  connect(): Promise<void>
  on<K extends keyof UniSatEvents>(
    event: K,
    handler: (...args: UniSatEvents[K]) => void,
  ): void
  on(event: "accountChanged" | "networkChanged", handler: () => void): void
  removeListener<K extends keyof UniSatEvents>(
    event: K,
    handler: (...args: UniSatEvents[K]) => void,
  ): void
  removeListener(
    event: "accountChanged" | "networkChanged",
    handler: () => void,
  ): void
}

export class OkxWalletAdapterImpl
  extends UnisatCompatibleWalletAdapterImpl
  implements WalletAdapter
{
  private okxwallet: OkxBitcoinProvider
  constructor(provider: OkxBitcoinProvider) {
    /**
     * OKX Provider API:
     *
     * https://web3.okx.com/zh-hans/build/dev-docs/sdks/chains/bitcoin/provider
     */
    super(provider, metadata.name)
    this.okxwallet = provider
  }

  async connect(): Promise<void> {
    // if not authorized, okx wallet will pop up a window to ask user to authorize
    // if authorized, okx wallet will do nothing
    await this.okxwallet.connect()
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    return handleRpcError(super.signMessage(address, message))
  }

  async sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
    options?: { feeRate?: number },
  ): Promise<{
    txid: string
  }> {
    return handleRpcError(
      super.sendBitcoin(fromAddress, receiverAddress, satoshiAmount, options),
    )
  }

  /**
   * @internal
   * @experimental
   */
  async sendInscription(
    fromAddress: string,
    receiverAddress: string,
    inscriptionId: string,
    options?: { feeRate?: number },
  ): Promise<{
    txid: string
  }> {
    return handleRpcError(
      super.sendInscription(
        fromAddress,
        receiverAddress,
        inscriptionId,
        options,
      ),
    )
  }

  async signAndFinalizePsbt(
    psbtHex: string,
    signIndices: [address: string, signIndex: number][],
  ): Promise<{
    signedPsbtHex: string
  }> {
    return handleRpcError(super.signAndFinalizePsbt(psbtHex, signIndices))
  }

  onAddressesChanged(callback: WalletAdapter_onAddressesChanged_callback): {
    unsubscribe: () => void
  } {
    // OKX uses 'accountChanged' (no 's') and 'networkChanged' events
    // https://web3.okx.com/build/dev-docs/sdks/chains/bitcoin/provider
    if (this.okxwallet?.on && this.okxwallet?.removeListener) {
      const handler = async (): Promise<void> => {
        try {
          const addresses = await this.getAddresses()
          callback({ addresses })
        } catch (error) {
          console.warn("[OKX] Failed to get addresses on change:", error)
        }
      }

      // Listen to account and network changes (OKX uses 'accountChanged' not 'accountsChanged')
      this.okxwallet.on("accountChanged", handler)
      this.okxwallet.on("networkChanged", handler)

      return {
        unsubscribe: () => {
          this.okxwallet.removeListener("accountChanged", handler)
          this.okxwallet.removeListener("networkChanged", handler)
        },
      }
    } else {
      // Fallback to parent implementation (polling)
      return super.onAddressesChanged(callback)
    }
  }
}

export class OkxWalletAdapterError extends BitcoinWalletAdapterError {
  constructor(rpcError: RpcError) {
    super("OKX wallet error: " + rpcError.message, { cause: rpcError })
  }
}

const handleRpcError = async <T>(promise: Promise<T>): Promise<T> => {
  try {
    return await promise
  } catch (e: any) {
    if (e instanceof UserRejectError) {
      throw e
    }

    if (e.code === RpcErrorCode.USER_REJECTION) {
      throw new UserRejectError()
    }

    throw new OkxWalletAdapterError(e)
  }
}
