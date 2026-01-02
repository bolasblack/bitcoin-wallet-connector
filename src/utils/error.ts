export class BitcoinWalletAdapterError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "BitcoinWalletAdapterError"
  }
}

export class UserRejectError extends BitcoinWalletAdapterError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "UserRejectError"
  }
}
