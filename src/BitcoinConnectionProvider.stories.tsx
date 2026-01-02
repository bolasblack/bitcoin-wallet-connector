import { Meta, StoryFn } from "@storybook/react-vite"
import React, { FC, useEffect, useState } from "react"
import {
  BitcoinConnectionProvider,
  useBitcoinConnectionContext,
  WalletSession,
} from "./BitcoinConnectionProvider"
import {
  WalletAdapter,
  WalletAdapterAddress,
  WalletAdapterBitcoinNetwork,
  WalletAdapterFactory,
} from "./WalletAdapters.types"
import {
  UnisatWalletAdapterFactory,
  XverseWalletAdapterFactory,
  OkxWalletAdapterFactory,
  LeatherWalletAdapterFactory,
  BitgetWalletAdapterFactory,
  MagicEdenWalletAdapterFactory,
} from "./adapters"

const adapterFactories: WalletAdapterFactory<WalletAdapter>[] = [
  UnisatWalletAdapterFactory(),
  XverseWalletAdapterFactory(),
  OkxWalletAdapterFactory(),
  LeatherWalletAdapterFactory(),
  BitgetWalletAdapterFactory(),
  MagicEdenWalletAdapterFactory({
    network: WalletAdapterBitcoinNetwork.MAINNET,
  }),
]

export default {
  title: "Components/BitcoinConnectionProvider",
  component: BitcoinConnectionProvider,
} as Meta<typeof BitcoinConnectionProvider>

const WalletConnectionContent = (): React.ReactElement => {
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [signMessageText, setSignMessageText] = useState("Hello Bitcoin!")
  const [selectedAddress, setSelectedAddress] = useState<string>("")
  const [signResult, setSignResult] = useState<string>("")
  const [isSigning, setIsSigning] = useState(false)
  const ctx = useBitcoinConnectionContext()

  const addDebugInfo = (info: string): void => {
    setDebugInfo(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${info}`,
    ])
  }

  const handleSignMessage = async (): Promise<void> => {
    if (!ctx.walletSession || !selectedAddress) return

    setIsSigning(true)
    addDebugInfo(`Signing message with ${selectedAddress.slice(0, 10)}...`)

    try {
      const result = await ctx.walletSession.adapter.signMessage(
        selectedAddress,
        signMessageText,
      )
      setSignResult(JSON.stringify(result, null, 2))
      addDebugInfo(`Sign success: ${result.algorithm}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addDebugInfo(`Sign failed: ${message}`)
      setSignResult(`Error: ${message}`)
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginBottom: "16px" }}>Bitcoin Connection Provider Demo</h2>

      <div style={{ marginBottom: "16px" }}>
        <h3>Connection Status</h3>
        <p>
          <strong>Connected:</strong> {ctx.walletSession ? "Yes" : "No"}
        </p>
        <p>
          <strong>Initializing:</strong>{" "}
          {ctx.isConnectionInitializing ? "Yes" : "No"}
        </p>
        {ctx.walletSession && (
          <>
            <p>
              <strong>Adapter ID:</strong> {ctx.walletSession.adapterId}
            </p>
            <p>
              <strong>Addresses:</strong>
            </p>
            <ul>
              {ctx.walletSession.addresses.map((addr, i) => (
                <li key={i}>
                  {addr.purposes.join(", ")}: {addr.address.slice(0, 20)}...
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <h3>Available Wallets ({ctx.availableAdapters.length})</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {ctx.availableAdapters.map(([adapterId, adapter]) => {
            const factory = adapterFactories.find(
              factory => factory.adapterId === adapterId,
            )!

            return (
              <div
                key={adapterId}
                onClick={() => {
                  addDebugInfo(`Connecting to ${adapterId}...`)
                  ctx
                    .connect(adapterId, adapter)
                    .then(() => {
                      addDebugInfo(`Connected to ${adapterId}`)
                    })
                    .catch(err => {
                      addDebugInfo(`Failed to connect: ${err.message}`)
                    })
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 16px",
                  cursor: ctx.isConnectionInitializing
                    ? "not-allowed"
                    : "pointer",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  background: "#fff",
                }}
              >
                {ctx.isConnectionInitializing ? (
                  "Connecting..."
                ) : (
                  <>
                    <WalletIcon adapterFactory={factory} />
                    <span>{factory.metadata.name}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {ctx.walletSession && (
        <button
          onClick={() => {
            addDebugInfo("Disconnecting...")
            void ctx.disconnect().then(() => {
              addDebugInfo("Disconnected")
            })
          }}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            border: "1px solid #dc3545",
            borderRadius: "4px",
            background: "#dc3545",
            color: "#fff",
            marginBottom: "16px",
          }}
        >
          Disconnect
        </button>
      )}

      {ctx.walletSession && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Sign Message</h3>
          <div style={{ marginBottom: "8px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>
              Select Address:
            </label>
            <select
              value={selectedAddress}
              onChange={e => setSelectedAddress(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">-- Select an address --</option>
              {ctx.walletSession.addresses.map((addr, i) => (
                <option key={i} value={addr.address}>
                  [{addr.purposes.join(", ")}] {addr.address.slice(0, 20)}...
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>
              Message to Sign:
            </label>
            <input
              type="text"
              value={signMessageText}
              onChange={e => setSignMessageText(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={() => void handleSignMessage()}
            disabled={!selectedAddress || isSigning}
            style={{
              padding: "8px 16px",
              cursor: !selectedAddress || isSigning ? "not-allowed" : "pointer",
              border: "1px solid #007bff",
              borderRadius: "4px",
              background: "#007bff",
              color: "#fff",
              opacity: !selectedAddress || isSigning ? 0.6 : 1,
            }}
          >
            {isSigning ? "Signing..." : "Sign Message"}
          </button>
          {signResult && (
            <div style={{ marginTop: "8px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>
                Result:
              </label>
              <pre
                style={{
                  background: "#f8f9fa",
                  padding: "8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "200px",
                  margin: 0,
                }}
              >
                {signResult}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: "16px" }}>
        <h3>Registered Adapter Factories ({ctx.adapterFactories.length})</h3>
        <ul>
          {ctx.adapterFactories.map((factory, i) => (
            <li key={i}>{factory.metadata.name}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => setDebugInfo([])}
        style={{
          padding: "4px 8px",
          cursor: "pointer",
          border: "1px solid #ccc",
          borderRadius: "4px",
          background: "#f8f9fa",
          marginBottom: "8px",
        }}
      >
        Clear Debug Info
      </button>

      {debugInfo.length > 0 && (
        <div
          style={{
            padding: "8px",
            background: "#f8f9fa",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0" }}>Debug Info:</h4>
          {debugInfo.map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export const Default: StoryFn<typeof BitcoinConnectionProvider> = () => {
  const [events, setEvents] = useState<string[]>([])

  const addEvent = (event: string): void => {
    setEvents(prev => [...prev, `${new Date().toLocaleTimeString()}: ${event}`])
  }

  return (
    <BitcoinConnectionProvider
      adapterFactories={adapterFactories}
      onWalletConnected={(session: WalletSession) => {
        addEvent(`Wallet connected: ${session.adapterId}`)
      }}
      onWalletAddressesChanged={(addresses: WalletAdapterAddress[]) => {
        addEvent(`Addresses changed: ${addresses.length} addresses`)
      }}
      onWalletDisconnected={() => {
        addEvent("Wallet disconnected")
      }}
    >
      <WalletConnectionContent />
      {events.length > 0 && (
        <div
          style={{
            margin: "16px",
            padding: "8px",
            background: "#e8f4f8",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0" }}>Provider Events:</h4>
          {events.map((event, index) => (
            <div key={index}>{event}</div>
          ))}
        </div>
      )}
    </BitcoinConnectionProvider>
  )
}

const WalletIcon: FC<{
  adapterFactory: WalletAdapterFactory<WalletAdapter>
}> = ({ adapterFactory }) => {
  const [iconUrl, setIconUrl] = useState<null | string>(null)

  useEffect(() => {
    const abortController = new AbortController()

    void adapterFactory.metadata
      .iconUrl()
      .then(url => {
        if (abortController.signal.aborted) return
        setIconUrl(url)
      })
      .catch(err => {
        console.error(
          "Failed to load icon for ",
          adapterFactory.metadata.name,
          err,
        )
      })

    return () => {
      abortController.abort()
    }
  }, [adapterFactory.metadata])

  if (!iconUrl) {
    return (
      <div
        style={{
          width: "24px",
          height: "24px",
          marginRight: "8px",
          borderRadius: "4px",
          background: "#eaeaea",
        }}
      ></div>
    )
  }

  return (
    <img
      src={iconUrl}
      alt={adapterFactory.metadata.name}
      style={{ width: "24px", height: "24px", marginRight: "8px" }}
    />
  )
}
