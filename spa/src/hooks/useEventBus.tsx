import { useEffect, useRef } from 'react';
import { eventBus, type EventMap } from '../services/event-bus';

/**
 * Hook to subscribe to events from the event bus
 * Automatically unsubscribes when the component unmounts
 * 
 * @param eventName The name of the event to subscribe to
 * @param callback The callback function to execute when the event is emitted
 * @param deps Optional dependency array (similar to useEffect)
 * 
 * @example
 * ```tsx
 * useEventBus('article:updated', (article) => {
 *   console.log('Article updated:', article);
 * });
 * ```
 */
export function useEventBus<T extends keyof EventMap>(
  eventName: T,
  callback: (data: EventMap[T]) => void,
  deps?: React.DependencyList
): void {
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: EventMap[T]) => {
      callbackRef.current(data);
    };

    const unsubscribe = eventBus.on(eventName, handler);

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...(deps || [])]);
}