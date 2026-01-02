import * as btc from "@scure/btc-signer"
import { checkNever } from "./misc"

export type BitcoinNetwork = typeof btc.NETWORK

export function getBitcoinNetwork(
  network: "mainnet" | "testnet",
): BitcoinNetwork {
  if (network === "mainnet") return btc.NETWORK
  if (network === "testnet") return btc.TEST_NETWORK
  checkNever(network as never)
  return btc.NETWORK
}

export function isMainnet(network: BitcoinNetwork): boolean {
  return network.bech32 === "bc"
}
