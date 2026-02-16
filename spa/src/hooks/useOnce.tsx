import { useEffect, useRef } from 'react';

/**
 * Hook that runs an effect only once when a condition becomes true
 * 
 * @param condition The condition to check
 * @param effect The effect to run when the condition becomes true
 * 
 * @example
 * ```tsx
 * useOnce(data?.length > 0, () => {
 *   // This will only run once when data first has length
 *   console.log('Data is available');
 * });
 * ```
 */
export function useOnce(condition: boolean, effect: () => void): void {
  const hasRunRef = useRef(false);
  const effectRef = useRef(effect);

  // Keep effect ref up to date
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    if (condition && !hasRunRef.current) {
      hasRunRef.current = true;
      effectRef.current();
    }
  }, [condition]);
}

