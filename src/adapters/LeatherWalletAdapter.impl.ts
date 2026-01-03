import type {
  RequestFn,
  RpcEndpointMap,
  RpcErrorBody,
  RpcErrorResponse,
} from "@leather.io/rpc"
import { hex } from "@scure/base"
import * as btc from "@scure/btc-signer"
import { LOCAL_STORAGE_KEY_PREFIX } from "../constants"
import {
  addressToScriptPubKey,
  getTapInternalKeyOf_P2TR_publicKey,
} from "../utils/bitcoinAddressHelpers"
import { getBitcoinNetwork } from "../utils/bitcoinNetworkHelpers"
import { BitcoinWalletAdapterError, UserRejectError } from "../utils/error"
import {
  SignMessageAlgorithm,
  SignMessageResult,
  WalletAdapter,
  WalletAdapter_onAddressesChanged_callback,
  WalletAdapterAddress,
  WalletAdapterAddressPurpose,
  WalletAdapterAddressType,
  WalletAdapterBitcoinNetwork,
  WalletAdapterNotConnectedError,
} from "../WalletAdapters.types"
import { adapterId, metadata } from "./LeatherWalletAdapter"

type PickSuccessResponse<T> = T extends { result: unknown } ? T : never

type GetAddressesResponseData = PickSuccessResponse<
  RpcEndpointMap["getAddresses"]["response"]
>

/**
 * https://github.com/leather-io/mono/blob/a664e64040fed1c25abef1f8864a1c7fae5444c1/packages/rpc/src/rpc/schemas.ts#L64-L78
 */
enum RpcErrorCode {
  // Spec defined server errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000,
  // Client defined errors
  USER_REJECTION = 4001,
  METHOD_NOT_SUPPORTED = 4002,
  // gRPC spec borrowed
  PERMISSION_DENIED = 7,
  UNAUTHENTICATED = 16,
}

type Addresses = (WalletAdapterAddress & { publicKey: string })[]

const localStorageKeyPrefix = `${LOCAL_STORAGE_KEY_PREFIX}:${adapterId}`
const connectedAddress_localStorageKey = `${localStorageKeyPrefix}:connectedAddress`

/**
 * Derivation path (BIP-84): m/84'/0'/ account_index '/0/0
 */
export class LeatherWalletAdapterImpl implements WalletAdapter {
  constructor(private request: RequestFn) {}

  private retrieveConnectedAddress_inMemory:
    | GetAddressesResponseData
    | undefined
  private retrieveConnectedAddress(): GetAddressesResponseData | undefined {
    if (this.retrieveConnectedAddress_inMemory != null) {
      return this.retrieveConnectedAddress_inMemory
    }

    let resp: GetAddressesResponseData | undefined
    const stored =
      localStorage.getItem(connectedAddress_localStorageKey) || undefined
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
        this.retrieveConnectedAddress_inMemory = resp
      } catch {
        localStorage.removeItem(connectedAddress_localStorageKey)
      }
    }

    return resp
  }

  async connect(): Promise<void> {
    if (this.retrieveConnectedAddress() == null) {
      const resp = await handleRpcError(
        /**
         * https://leather.gitbook.io/developers/bitcoin/connect-users/get-addresses
         */
        this.request("getAddresses"),
      )
      this.retrieveConnectedAddress_inMemory = resp
      localStorage.setItem(
        connectedAddress_localStorageKey,
        JSON.stringify(resp),
      )
    }
  }

  async disconnect(): Promise<void> {
    this.retrieveConnectedAddress_inMemory = undefined
    localStorage.removeItem(connectedAddress_localStorageKey)
    return Promise.resolve()
  }

  async getAddresses(): Promise<Addresses> {
    const resp = this.retrieveConnectedAddress()

    if (resp == null) {
      throw new WalletAdapterNotConnectedError(metadata.name)
    }

    const addresses = resp.result.addresses.filter(
      (a: any) => (a as any).symbol === "BTC" && a.type,
    )

    const isMainnet = addresses
      .filter((a: any) => a.type === "p2tr")[0]
      .address.startsWith("bc")

    return addresses.map((a: any) => ({
      network: isMainnet
        ? WalletAdapterBitcoinNetwork.MAINNET
        : WalletAdapterBitcoinNetwork.TESTNET,
      purposes:
        a.type === "p2tr"
          ? [
              WalletAdapterAddressPurpose.Ordinals,
              WalletAdapterAddressPurpose.BRC20,
              WalletAdapterAddressPurpose.Runes,
            ]
          : [WalletAdapterAddressPurpose.Bitcoin],
      addressType:
        a.type === "p2tr"
          ? WalletAdapterAddressType.P2TR
          : WalletAdapterAddressType.P2WPKH,
      address: a.address,
      scriptPubKey: hex.encode(
        addressToScriptPubKey(
          getBitcoinNetwork(isMainnet ? "mainnet" : "testnet"),
          a.address,
        ),
      ),
      publicKey: a.publicKey!,
      tapInternalKey:
        a.type === "p2tr"
          ? hex.encode(
              getTapInternalKeyOf_P2TR_publicKey(
                getBitcoinNetwork(isMainnet ? "mainnet" : "testnet"),
                hex.decode(a.publicKey!),
              ),
            )
          : undefined,
    }))
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    const accounts = await this.getAddresses()

    const addressType = accounts.find(a => a.address === address)?.addressType

    // prettier-ignore
    const paymentType =
      addressType === WalletAdapterAddressType.P2WPKH ? 'p2wpkh' as const :
      addressType === WalletAdapterAddressType.P2TR ? 'p2tr' as const :
      undefined
    if (paymentType == null) {
      throw new BitcoinWalletAdapterError(`Address ${address} is not supported`)
    }

    const resp: any = await handleRpcError(
      /**
       * https://leather.gitbook.io/developers/bitcoin-methods/signmessage
       */
      this.request("signMessage", {
        message,
        paymentType,
      }),
    )

    return {
      algorithm:
        resp.algorithm === "ecdsa"
          ? SignMessageAlgorithm.ECDSA
          : SignMessageAlgorithm.BIP322,
      result: resp.signature,
      address,
      publicKey: resp.publicKey,
    }
  }

  sendBitcoinFeeRateCapability = "unavailable" as const
  async sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
  ): Promise<{ txid: string }> {
    const addresses = await this.getAddresses()
    const foundAddressIndex = addresses.findIndex(
      a => a.address === fromAddress,
    )
    if (foundAddressIndex < 0) {
      throw new BitcoinWalletAdapterError(
        `Address ${fromAddress} is not supported`,
      )
    }

    const resp: any = await handleRpcError(
      /**
       * https://leather.gitbook.io/developers/bitcoin-methods/sendtransfer
       */
      this.request("sendTransfer", {
        recipients: [
          {
            address: receiverAddress,
            amount: satoshiAmount.toString(),
          },
        ],
        account: foundAddressIndex,
        network:
          addresses[foundAddressIndex].network ===
          WalletAdapterBitcoinNetwork.MAINNET
            ? "mainnet"
            : "testnet",
      }),
    )

    return { txid: resp.txid }
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
    const resp: any = await handleRpcError(
      /**
       * https://leather.gitbook.io/developers/bitcoin-methods/signpsbt
       */
      this.request("signPsbt", {
        hex: psbtHex,
        signAtIndex: signIndices.map(([, signIndex]) => signIndex),
      }),
    )

    // signPsbt returns a signed but not finalized PSBT, need to finalize it
    const tx = btc.Transaction.fromPSBT(hex.decode(resp.hex), {
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
    // Leather doesn't provide event, fallback to polling
    let stopped = false

    const tick = async (): Promise<void> => {
      if (stopped) return
      try {
        const addresses = await this.getAddresses()
        callback({ addresses })
      } catch (error) {
        if (error instanceof WalletAdapterNotConnectedError) {
          stopped = true
          return
        }
        console.warn("[Leather] Failed to get addresses on change:", error)
      } finally {
        if (!stopped) {
          setTimeout(tick, 1000)
        }
      }
    }

    setTimeout(tick, 1000)

    return {
      unsubscribe: () => {
        stopped = true
      },
    }
  }
}

export class LeatherWalletAdapterError extends BitcoinWalletAdapterError {
  constructor(rpcError: RpcErrorResponse<RpcErrorBody>) {
    super("Leather wallet error: " + rpcError.error.message, {
      cause: rpcError,
    })
  }
}

const handleRpcError = async <T>(
  promise: Promise<T>,
): Promise<NonNullable<T>> => {
  try {
    return (await promise) as NonNullable<T>
  } catch (e: any) {
    if (e instanceof UserRejectError) {
      throw e
    }

    if (e.error?.code === RpcErrorCode.USER_REJECTION) {
      throw new UserRejectError()
    }

    throw new LeatherWalletAdapterError(e)
  }
}
