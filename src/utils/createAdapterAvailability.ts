export type GetPreconditionFn<T> = () => null | { value: T }

export type InitializerFn<I, T> = (precondition: I) => T | Promise<T>

export interface AvailabilitySubscription {
  unsubscribe: () => void
}

export interface Availability<T> {
  subscribe: (listener: (adapter: T) => void) => AvailabilitySubscription
}

export function createAvailability<I, T>({
  getPrecondition,
  initializer,
  pollIntervalMs = 300,
}: {
  getPrecondition: GetPreconditionFn<I>
  initializer: InitializerFn<I, T>
  pollIntervalMs?: number
}): Availability<T> {
  let cachedAdapter: T | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  let creating = false

  const listeners = new Set<(adapter: T) => void>()

  const stopPolling = (): void => {
    if (polling != null) {
      clearInterval(polling)
      polling = null
    }
  }

  const emit = (adapter: T): void => {
    cachedAdapter = adapter
    for (const listener of listeners) {
      listener(adapter)
    }
  }

  const attemptCreate = async (): Promise<void> => {
    if (cachedAdapter != null || creating) return
    const precondition = getPrecondition()
    if (precondition == null) return

    creating = true
    try {
      const adapter = await initializer(precondition.value)
      emit(adapter)
      stopPolling()
    } catch (error) {
      console.warn("[WalletAdapter] Failed to initialize adapter", error)
    } finally {
      creating = false
    }
  }

  const ensurePolling = (): void => {
    if (cachedAdapter != null) return

    void attemptCreate()
    if (cachedAdapter != null || polling != null) return

    polling = setInterval(() => {
      void attemptCreate()
    }, pollIntervalMs)
  }

  return {
    subscribe: listener => {
      if (cachedAdapter != null) {
        listener(cachedAdapter)
        return { unsubscribe: () => {} }
      }

      listeners.add(listener)
      ensurePolling()

      const subscription: AvailabilitySubscription = {
        unsubscribe: () => {
          listeners.delete(listener)
          if (listeners.size === 0) {
            stopPolling()
          }
        },
      }

      return subscription
    },
  }
}
