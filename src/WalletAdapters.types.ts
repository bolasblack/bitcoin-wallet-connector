import { Availability } from "./utils/createAdapterAvailability"

export enum WalletAdapterBitcoinNetwork {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  UNKNOWN = "unknown",
}

export enum WalletAdapterAddressPurpose {
  Bitcoin = "bitcoin",
  Ordinals = "ordinals",
  BRC20 = "brc20",
  Runes = "runes",
}

// prettier-ignore
export enum WalletAdapterAddressType {
  P2SH_P2WPKH = "p2sh-p2wpkh", // aka Nested SegWit
  P2WPKH = "p2wpkh",           // aka Native SegWit
  P2TR = "p2tr",               // aka Taproot
  P2PKH = "p2pkh",             // aka Legacy
}

export enum SignMessageAlgorithm {
  ECDSA = "ECDSA",
  BIP322 = "BIP322",
}
export type SignMessageResult =
  | SignMessageResult.ECDSA
  | SignMessageResult.BIP322
export namespace SignMessageResult {
  export interface ECDSA {
    algorithm: SignMessageAlgorithm.ECDSA
    result: string
    address: string
    publicKey: string
  }

  export interface BIP322 {
    algorithm: SignMessageAlgorithm.BIP322
    result: string
    address: string
  }
}

export interface WalletAdapterAddressBasic {
  addressType: WalletAdapterAddressType
  address: string
  scriptPubKey: string
}

export interface WalletAdapterAddressWithPublicKey {
  /**
   * Some wallet may won't give us the public key of the address, like Xverse
   */
  publicKey: string
}

export interface WalletAdapterAddressWithRedeemScript {
  /**
   * Some address is SH address, which requires redeem script to spend, like Xverse
   */
  redeemScript: string
}

export interface WalletAdapterAddressWithTapInternalKey {
  /**
   * Some address is taproot address, which requires taproot internal key to spend.
   */
  tapInternalKey: string
}

export interface WalletAdapterAddress extends Partial<
  WalletAdapterAddressWithPublicKey &
    WalletAdapterAddressWithRedeemScript &
    WalletAdapterAddressWithTapInternalKey
> {
  addressType: WalletAdapterAddressType
  address: string
  scriptPubKey: string
  network: WalletAdapterBitcoinNetwork
  purposes: WalletAdapterAddressPurpose[]
}

export interface WalletAdapterMetadata {
  name: string
  iconUrl: () => Promise<string>
  websiteUrl: string
  downloadUrl: string
}

export interface WalletAdapterFactory<T extends WalletAdapter> {
  adapterId: string
  metadata: WalletAdapterMetadata
  getAdapter(): Availability<T>
}

export type WalletAdapter_onAddressesChanged_callback = (data: {
  addresses: WalletAdapterAddress[]
}) => void

export interface WalletAdapter {
  connect(): Promise<void>

  disconnect(): Promise<void>

  getAddresses(): Promise<WalletAdapterAddress[]>
  onAddressesChanged(callback: WalletAdapter_onAddressesChanged_callback): {
    unsubscribe: () => void
  }

  signMessage(address: string, message: string): Promise<SignMessageResult>

  signAndFinalizePsbt(
    psbtHex: string,
    signIndices: [address: string, signIndex: number][],
  ): Promise<{ signedPsbtHex: string }>

  sendBitcoinFeeRateCapability: WalletAdapterSendBitcoinCapability
  sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
    options?: { feeRate?: number },
  ): Promise<{ txid: string }>
}

export type WalletAdapterSendBitcoinCapability =
  | "unavailable"
  | "available"
  | "required"

export class WalletAdapterErrorBase extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WalletAdapterErrorBase"
  }
}

export class WalletAdapterNotConnectedError extends WalletAdapterErrorBase {
  constructor(walletName: string, message?: string) {
    super(message ?? `Wallet ${walletName} is not connected`)
    this.name = "WalletAdapterNotConnectedError"
  }
}
