export class BitcoinWalletAdapterError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "Unknown error", options)
    this.name = "BitcoinWalletAdapterError"
  }
}

export class UserRejectError extends BitcoinWalletAdapterError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "User rejected the operation", options)
    this.name = "UserRejectError"
  }
}
