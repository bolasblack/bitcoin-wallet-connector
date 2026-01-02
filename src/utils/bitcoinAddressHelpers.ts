import { hex } from "@scure/base"
import * as btc from "@scure/btc-signer"
import { Address, OutScript } from "@scure/btc-signer"
import { BitcoinNetwork, isMainnet } from "./bitcoinNetworkHelpers"

export type AddressTypeKnown = "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr"
export type AddressType = AddressTypeKnown | "unknown"

export function getAddressType(
  network: BitcoinNetwork,
  address: string,
): AddressType {
  if (isP2PKHAddress(network, address)) {
    return "p2pkh"
  } else if (isP2SHAddress(network, address)) {
    return "p2sh"
  } else if (isP2WPKHAddress(network, address)) {
    return "p2wpkh"
  } else if (isP2WSHAddress(network, address)) {
    return "p2wsh"
  } else if (isP2TRAddress(network, address)) {
    return "p2tr"
  } else {
    return "unknown"
  }
}

export function isP2PKHAddress(
  network: BitcoinNetwork,
  address: string,
): boolean {
  if (isMainnet(network)) {
    return address.startsWith("1")
  } else {
    return address.startsWith("m") || address.startsWith("n")
  }
}

export function isP2SHAddress(
  network: BitcoinNetwork,
  address: string,
): boolean {
  if (isMainnet(network)) {
    return address.startsWith("3")
  } else {
    return address.startsWith("2")
  }
}

export function isP2WPKHAddress(
  network: BitcoinNetwork,
  address: string,
): boolean {
  if (isMainnet(network)) {
    return address.startsWith("bc1q")
  } else {
    return address.startsWith("tb1q")
  }
}

export function isP2TRAddress(
  network: BitcoinNetwork,
  address: string,
): boolean {
  if (isMainnet(network)) {
    return address.startsWith("bc1p")
  } else {
    return address.startsWith("tb1p")
  }
}

export function isP2WSHAddress(
  network: BitcoinNetwork,
  address: string,
): boolean {
  if (isP2TRAddress(network, address)) {
    return false
  }
  if (isP2WPKHAddress(network, address)) {
    return false
  }

  if (isMainnet(network)) {
    return address.startsWith("bc1")
  } else {
    return address.startsWith("tb1")
  }
}

export function getP2TRInternalPublicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  const ecdsaPublicKeyLength = 33
  if (publicKey.byteLength !== ecdsaPublicKeyLength) {
    throw new Error("Invalid public key length")
  }
  return publicKey.slice(1)
}

export function getTapInternalKeyOf_P2TR_publicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  return btc.p2tr(
    getP2TRInternalPublicKey(network, publicKey),
    undefined,
    network,
  ).tapInternalKey
}

export function getRedeemScriptOf_P2SH_P2WPKH_publicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  return btc.p2sh(btc.p2wpkh(publicKey, network), network).redeemScript!
}

export function addressToScriptPubKey(
  network: BitcoinNetwork,
  address: string,
): Uint8Array {
  const addr = Address(network).decode(address)
  return OutScript.encode(addr)
}

export function addressToScriptPubKeyHex(
  network: BitcoinNetwork,
  address: string,
): string {
  return hex.encode(addressToScriptPubKey(network, address))
}
