import { hex } from "@scure/base"
import * as btc from "@scure/btc-signer"
import { hasAny } from "./misc"
import {
  addressToScriptPubKey,
  getAddressType,
  getRedeemScriptOf_P2SH_P2WPKH_publicKey,
  getTapInternalKeyOf_P2TR_publicKey,
} from "./bitcoinAddressHelpers"
import { getBitcoinNetwork } from "./bitcoinNetworkHelpers"
import { UserRejectError, BitcoinWalletAdapterError } from "../utils/error"
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
  WalletAdapter_sendBitcoinFeeRateCapability,
} from "../WalletAdapters.types"

/**
 * https://docs.unisat.io/dev-center/open-api-documentation/unisat-wallet#events
 */
export interface UniSatEvents {
  accountsChanged: [accounts: Array<string>]
  networkChanged: [network: string]
}

export interface UnisatCompatibleProviderAPI {
  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#getaccounts
   */
  getAccounts(): Promise<string[]>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#requestaccounts
   */
  requestAccounts(): Promise<string[]>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#getpublickey
   */
  getPublicKey(): Promise<string>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#getnetwork
   */
  getNetwork(): Promise<"livenet" | "testnet">

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#signmessage
   */
  signMessage(
    message: string,
    algorithm: "ecdsa" | "bip322-simple",
  ): Promise<string>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#sendbitcoin
   */
  sendBitcoin(
    receiverAddress: string,
    satoshiAmount: number,
    options?: { feeRate?: number },
  ): Promise<string>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#sendInscription
   */
  sendInscription(
    receiverAddress: string,
    inscriptionId: string,
    options?: { feeRate?: number },
  ): Promise<string>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#signpsbt
   */
  signPsbt(
    psbtHex: string,
    options?: {
      autoFinalized?: boolean
      toSignInputs?: {
        index: number
        address?: string
        publicKey?: string
        sighashTypes?: number[]
        disableTweakSigner?: boolean
      }[]
    },
  ): Promise<string>

  /**
   * https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet#events
   */
  on<K extends keyof UniSatEvents>(
    event: K,
    handler: (...args: UniSatEvents[K]) => void,
  ): void
  removeListener(event: keyof UniSatEvents, handler: () => void): void
}

export type UnisatCompatibleWalletAdapterAddresses = (WalletAdapterAddress & {
  publicKey: string
})[]

export class UnisatCompatibleWalletAdapterImpl implements WalletAdapter {
  constructor(
    private unisat: UnisatCompatibleProviderAPI,
    private walletDisplayName: string,
  ) {}

  async connect(): Promise<void> {
    if ((await this.unisat.getAccounts()).length === 0) {
      await this.unisat.requestAccounts()
    }
  }

  disconnect(): Promise<void> {
    // do nothing
    return Promise.resolve()
  }

  async getAddresses(): Promise<UnisatCompatibleWalletAdapterAddresses> {
    const addresses: string[] = await this.unisat.getAccounts()

    if (addresses.length === 0) {
      throw new WalletAdapterNotConnectedError(this.walletDisplayName)
    }

    const publicKey: string = await this.unisat.getPublicKey()

    const _network: "livenet" | "testnet" = await this.unisat.getNetwork()
    const network = _network === "livenet" ? "mainnet" : "testnet"

    if (!hasAny(addresses)) {
      throw new BitcoinWalletAdapterError("Request wallet addresses failed")
    }

    const address = addresses[0]
    const addrType = getAddressType(getBitcoinNetwork(network), address)
    // prettier-ignore
    const addressType =
      addrType === "p2tr" ? WalletAdapterAddressType.P2TR :
      addrType === "p2sh" ? WalletAdapterAddressType.P2SH_P2WPKH :
      addrType === "p2wpkh" ? WalletAdapterAddressType.P2WPKH :
      undefined

    if (addressType == null) {
      throw new BitcoinWalletAdapterError("Please select a SegWit address")
    }

    const scriptPubKey = hex.encode(
      addressToScriptPubKey(getBitcoinNetwork(network), address),
    )

    const tapInternalKey =
      addressType !== WalletAdapterAddressType.P2TR
        ? undefined
        : hex.encode(
            getTapInternalKeyOf_P2TR_publicKey(
              getBitcoinNetwork(network),
              hex.decode(publicKey),
            ),
          )

    const redeemScript =
      addressType !== WalletAdapterAddressType.P2SH_P2WPKH
        ? undefined
        : hex.encode(
            getRedeemScriptOf_P2SH_P2WPKH_publicKey(
              getBitcoinNetwork(network),
              hex.decode(publicKey),
            ),
          )

    return [
      {
        addressType,
        address,
        scriptPubKey,
        redeemScript,
        tapInternalKey,
        publicKey,
        network:
          network === "mainnet"
            ? WalletAdapterBitcoinNetwork.MAINNET
            : WalletAdapterBitcoinNetwork.TESTNET,
        purposes: [
          WalletAdapterAddressPurpose.Bitcoin,
          WalletAdapterAddressPurpose.Ordinals,
          WalletAdapterAddressPurpose.BRC20,
          WalletAdapterAddressPurpose.Runes,
        ],
      },
    ]
  }

  async signMessage(
    address: string,
    message: string,
  ): Promise<SignMessageResult> {
    const result = await handleRpcError(
      this.unisat.signMessage(message, "bip322-simple"),
    )

    return {
      result,
      address,
      algorithm: SignMessageAlgorithm.BIP322,
    }
  }

  sendBitcoinFeeRateCapability: WalletAdapter_sendBitcoinFeeRateCapability =
    "available" as const
  async sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
    options?: { feeRate?: number },
  ): Promise<{ txid: string }> {
    const txid = await handleRpcError(
      this.unisat.sendBitcoin(receiverAddress, Number(satoshiAmount), {
        feeRate: options?.feeRate,
      }),
    )
    return { txid }
  }

  /**
   * @internal
   * @experimental
   */
  sendInscriptionFeeRateCapability: "unavailable" | "available" | "required" =
    "available" as const
  /**
   * @internal
   * @experimental
   */
  async sendInscription(
    fromAddress: string,
    receiverAddress: string,
    inscriptionId: string,
    options?: { feeRate?: number },
  ): Promise<{ txid: string }> {
    const txid = await handleRpcError(
      this.unisat.sendInscription(receiverAddress, inscriptionId, {
        feeRate: options?.feeRate,
      }),
    )
    return { txid }
  }

  async signAndFinalizePsbt(
    psbtHex: string,
    signIndices: [address: string, signIndex: number][],
  ): Promise<{
    signedPsbtHex: string
  }> {
    const signedPsbtHex = await handleRpcError(
      this.unisat.signPsbt(psbtHex, {
        autoFinalized: false,
        toSignInputs: signIndices.map(([address, signIndex]) => ({
          index: signIndex,
          address,
        })),
      }),
    )

    /**
     * Some version of unisat's signPsbt API does not working well with the autoFinalized option,
     * so we finalize the PSBT manually.
     */
    const tx = btc.Transaction.fromPSBT(hex.decode(signedPsbtHex), {
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
    const handler = async (): Promise<void> => {
      try {
        const addresses = await this.getAddresses()
        callback({ addresses })
      } catch (error) {
        // Ignore errors from getAddresses (e.g., wallet disconnected)
        console.warn(
          `[${this.walletDisplayName}] Failed to get addresses on change:`,
          error,
        )
      }
    }

    // Listen to both account and network changes
    this.unisat.on("accountsChanged", handler)
    this.unisat.on("networkChanged", handler)

    return {
      unsubscribe: () => {
        this.unisat.removeListener("accountsChanged", handler)
        this.unisat.removeListener("networkChanged", handler)
      },
    }
  }
}

interface UnisatCompatibleProviderAPIThrownError {
  code: number
  message: string
}
function isUnisatCompatibleProviderAPIThrownError(
  err: any,
): err is UnisatCompatibleProviderAPIThrownError {
  return err != null && "code" in err && "message" in err
}

export class UnisatCompatibleProviderError extends Error {
  readonly code: number
  constructor(err: UnisatCompatibleProviderAPIThrownError) {
    super(err.message)
    this.code = err.code
    this.cause = err
  }
}

const handleRpcError = async <T>(promise: Promise<T>): Promise<T> => {
  try {
    return await promise
  } catch (e: any) {
    if (isUnisatCompatibleProviderAPIThrownError(e)) {
      if (e.code === 4001) {
        throw new UserRejectError()
      }
      throw new UnisatCompatibleProviderError(e)
    }
    throw e
  }
}
