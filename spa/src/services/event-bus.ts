import type { EventMap } from '../types/EventMap';

type EventCallback<T = unknown> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   * @param eventName The name of the event to subscribe to
   * @param callback The callback function to execute when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  on<T extends keyof EventMap>(
    eventName: T,
    callback: EventCallback<EventMap[T]>
  ): () => void {
    if (!this.listeners.has(eventName as string)) {
      this.listeners.set(eventName as string, new Set());
    }

    const callbacks = this.listeners.get(eventName as string);
    if (callbacks) {
      callbacks.add(callback as EventCallback);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventName as string);
      if (callbacks) {
        callbacks.delete(callback as EventCallback);
        if (callbacks.size === 0) {
          this.listeners.delete(eventName as string);
        }
      }
    };
  }

  /**
   * Subscribe to an event once (automatically unsubscribes after first emission)
   * @param eventName The name of the event to subscribe to
   * @param callback The callback function to execute when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  once<T extends keyof EventMap>(
    eventName: T,
    callback: EventCallback<EventMap[T]>
  ): () => void {
    let unsubscribe: (() => void) | null = null;

    const wrappedCallback = (data: EventMap[T]) => {
      callback(data);
      if (unsubscribe) {
        unsubscribe();
      }
    };

    unsubscribe = this.on(eventName, wrappedCallback);
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers
   * @param eventName The name of the event to emit
   * @param data The data to pass to subscribers
   */
  emit<T extends keyof EventMap>(eventName: T, data: EventMap[T]): void {
    const callbacks = this.listeners.get(eventName as string);
    if (callbacks) {
      // Create a copy of the set to avoid issues if callbacks modify the set during iteration
      const callbacksCopy = new Set(callbacks);
      callbacksCopy.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for "${String(eventName)}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event
   * @param eventName The name of the event to clear
   */
  off<T extends keyof EventMap>(eventName: T): void {
    this.listeners.delete(eventName as string);
  }

  /**
   * Remove all listeners for all events
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for a specific event
   * @param eventName The name of the event
   * @returns The number of listeners
   */
  listenerCount<T extends keyof EventMap>(eventName: T): number {
    const callbacks = this.listeners.get(eventName as string);
    return callbacks ? callbacks.size : 0;
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Re-export EventMap for module augmentation
export type { EventMap };

