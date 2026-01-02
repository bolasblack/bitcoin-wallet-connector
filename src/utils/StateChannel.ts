export type StateChannelListener<T> = (value: T) => void

export interface StateChannelSubscription {
  unsubscribe: () => void
}

export class StateChannel<T> {
  private listeners = new Set<StateChannelListener<T>>()
  constructor(private value: T) {}

  getValue(): T {
    return this.value
  }

  setValue(value: T): void {
    this.value = value
    this.emit()
  }

  update(updater: (current: T) => T): void {
    this.setValue(updater(this.value))
  }

  subscribe(listener: StateChannelListener<T>): StateChannelSubscription {
    this.listeners.add(listener)
    listener(this.value)
    return {
      unsubscribe: () => {
        this.listeners.delete(listener)
      },
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.value)
    }
  }
}
