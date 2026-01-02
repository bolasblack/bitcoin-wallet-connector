import type { RequestFn } from "@leather.io/rpc"
import { createAvailability } from "../utils/createAdapterAvailability"
import type {
  WalletAdapter,
  WalletAdapterFactory,
} from "../WalletAdapters.types"

const adapterId = "LeatherProvider.BitcoinProvider"

const metadata = {
  name: "Leather",
  iconUrl: () => import("../_/leather.svg").then(m => m.default),
  websiteUrl: "https://leather.io/",
  downloadUrl: "https://leather.io/wallet",
}

const availability = createAvailability<RequestFn, WalletAdapter>({
  getPrecondition: () => {
    const request = (window as any).LeatherProvider?.request as
      | RequestFn
      | undefined
    return request == null ? null : { value: request }
  },
  initializer: async request => {
    const { LeatherWalletAdapterImpl } =
      await import("./LeatherWalletAdapter.impl")
    return new LeatherWalletAdapterImpl(request)
  },
})

export function LeatherWalletAdapterFactory(): WalletAdapterFactory<WalletAdapter> {
  return {
    adapterId,
    metadata,
    getAdapter: () => availability,
  }
}
