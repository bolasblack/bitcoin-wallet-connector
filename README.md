# bitcoin-wallet-connector [![Netlify Status](https://api.netlify.com/api/v1/badges/225930d8-e726-4971-8f88-d931576bec64/deploy-status)](https://bitcoin-wallet-connector.netlify.app/)

A unified interface for interacting with multiple Bitcoin wallet browser extensions.

**[Demo](https://bitcoin-wallet-connector.netlify.app/iframe.html?id=components-bitcoinconnectionprovider--default&viewMode=story)** / **[Storybook](https://bitcoin-wallet-connector.netlify.app/)**

## Features

This library is carefully designed with a focus on **API compatibility** and **dependency security**.

### Unified API

- **Normalizes wallet differences** - Each Bitcoin wallet has its own unique API. This library provides a consistent interface across all supported wallets, so you can write your code once and support multiple wallets.
- **Auto-discovery** - Automatically detects which wallet extensions are installed in the user's browser and makes them available for connection.

### Security-First Design

- **Minimal dependencies** - All dependencies are declared as peer dependencies, not bundled. This means you install them directly in your project and have full control over their versions. If a security vulnerability is discovered, you can upgrade immediately without waiting for this library to release an update.
- **Optional wallet SDKs** - Wallet SDKs (like `sats-connect` or `@leather.io/rpc`) are optional peer dependencies. You only need to install them if you use the corresponding adapter.
- **Lazy loading via dynamic imports** - Wallet SDKs are loaded via `dynamic import()` only when the user attempts to connect to that specific wallet. Even if a supply chain attack compromises an optional SDK, it won't be loaded unless the user explicitly tries to connect to that wallet.

## Supported Wallets

| Wallet                                     | Adapter                         | Optional Dependency |
| ------------------------------------------ | ------------------------------- | ------------------- |
| [Unisat](https://unisat.io/)               | `UnisatWalletAdapterFactory`    | -                   |
| [Xverse](https://www.xverse.app/)          | `XverseWalletAdapterFactory`    | `sats-connect`      |
| [OKX](https://www.okx.com/web3)            | `OkxWalletAdapterFactory`       | -                   |
| [Leather](https://leather.io/)             | `LeatherWalletAdapterFactory`   | `@leather.io/rpc`   |
| [Bitget](https://web3.bitget.com/)         | `BitgetWalletAdapterFactory`    | -                   |
| [Magic Eden](https://wallet.magiceden.io/) | `MagicEdenWalletAdapterFactory` | `sats-connect`      |

## Installation

```bash
pnpm add bitcoin-wallet-connector @scure/base @scure/btc-signer
```

### Optional Dependencies

Install based on which wallets you need to support:

```bash
# For Xverse / Magic Eden wallet support
pnpm add sats-connect

# For Leather wallet support
pnpm add @leather.io/rpc
```

## Usage

### Basic Usage (Vanilla JS/TS)

```typescript
import {
  BitcoinWalletConnector,
  UnisatWalletAdapterFactory,
  XverseWalletAdapterFactory,
} from "bitcoin-wallet-connector"

const connector = new BitcoinWalletConnector([
  UnisatWalletAdapterFactory(),
  XverseWalletAdapterFactory(),
])

// Subscribe to available wallets
// Note: Wallet extensions inject APIs at unpredictable times,
// so prefer subscribe over getAvailableAdapters()
connector.subscribeAvailableAdapters(availableAdapters => {
  console.log(
    "Available:",
    availableAdapters.map(([id]) => id),
  )
  // => ['unisat', 'xverse', ...]
})

// Connect to a wallet (usually triggered by user clicking a wallet button)
const [adapterId, adapter] = availableAdapters[0]
await connector.connect(adapterId, adapter)

// Get addresses
const addresses = await adapter.getAddresses()

// Sign a message
const result = await adapter.signMessage(addresses[0].address, "Hello Bitcoin!")

// Disconnect
await connector.disconnect()
```

### React Integration

```tsx
import {
  BitcoinConnectionProvider,
  useBitcoinConnectionContext,
} from "bitcoin-wallet-connector/react"
import {
  UnisatWalletAdapterFactory,
  XverseWalletAdapterFactory,
} from "bitcoin-wallet-connector/adapters"

const adapterFactories = [
  UnisatWalletAdapterFactory(),
  XverseWalletAdapterFactory(),
]

function App() {
  return (
    <BitcoinConnectionProvider
      adapterFactories={adapterFactories}
      onWalletConnected={session => console.log("Connected:", session)}
      onWalletDisconnected={() => console.log("Disconnected")}
    >
      <WalletUI />
    </BitcoinConnectionProvider>
  )
}

function WalletUI() {
  const {
    walletSession,
    isConnectionInitializing,
    availableAdapters,
    connect,
    disconnect,
  } = useBitcoinConnectionContext()

  if (walletSession) {
    return (
      <div>
        <p>Connected: {walletSession.adapterId}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      {availableAdapters.map(([adapterId, adapter]) => (
        <button
          key={adapterId}
          onClick={() => connect(adapterId, adapter)}
          disabled={isConnectionInitializing}
        >
          Connect {adapterId}
        </button>
      ))}
    </div>
  )
}
```

## API

### WalletAdapter Interface

All adapters implement the following interface:

```typescript
interface WalletAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>

  getAddresses(): Promise<WalletAdapterAddress[]>

  signMessage(address: string, message: string): Promise<SignMessageResult>

  sendBitcoinFeeRateCapability: WalletAdapterSendBitcoinCapability
  sendBitcoin(
    fromAddress: string,
    receiverAddress: string,
    satoshiAmount: bigint,
    options?: { feeRate?: number },
  ): Promise<{ txid: string }>

  signAndFinalizePsbt(
    psbtHex: string,
    signIndices: [address: string, signIndex: number][],
  ): Promise<{ signedPsbtHex: string }>

  onAddressesChanged(callback): { unsubscribe: () => void }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run Storybook
pnpm storybook

# Run tests
pnpm test
```

## License

MIT
