# bitcoin-wallet-connector

A unified interface for interacting with multiple Bitcoin wallet browser extensions.

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
| [Unisat](https://unisat.io/)               | `UnisatWalletAdapter`           | -                   |
| [Xverse](https://www.xverse.app/)          | `XverseWalletAdapter`           | `sats-connect`      |
| [OKX](https://www.okx.com/web3)            | `OkxWalletAdapter`              | -                   |
| [Leather](https://leather.io/)             | `LeatherWalletAdapter`          | `@leather.io/rpc`   |
| [Bitget](https://web3.bitget.com/)         | `BitgetWalletAdapter`           | -                   |
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

# For React integration
pnpm add react
```

## Usage

### Basic Usage (Vanilla JS/TS)

```typescript
import {
  BitcoinWalletAdapterConnector,
  UnisatWalletAdapter,
  XverseWalletAdapter,
} from "bitcoin-wallet-connector"

const connector = new BitcoinWalletAdapterConnector([
  UnisatWalletAdapter,
  XverseWalletAdapter,
])

// Get available wallets
const availableAdapters = connector.getAvailableAdapters()
// => [['unisat', adapter], ['xverse', adapter], ...]

// Connect to a wallet
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
  UnisatWalletAdapter,
  XverseWalletAdapter,
} from "bitcoin-wallet-connector/adapters"

const adapterFactories = [UnisatWalletAdapter, XverseWalletAdapter]

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
  onAddressesChanged(callback): { unsubscribe: () => void }
  signMessage(address: string, message: string): Promise<SignMessageResult>
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
}
```

### Address Types

```typescript
enum WalletAdapterAddressType {
  P2SH_P2WPKH = "p2sh-p2wpkh", // Nested SegWit
  P2WPKH = "p2wpkh", // Native SegWit
  P2TR = "p2tr", // Taproot
  P2PKH = "p2pkh", // Legacy
}

enum WalletAdapterAddressPurpose {
  Bitcoin = "bitcoin",
  Ordinals = "ordinals",
  BRC20 = "brc20",
  Runes = "runes",
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
