import { useState, useEffect } from "react";

/**
 * A custom React hook that defers updating a value until a specified delay has passed.
 * Used to optimize search filtering operations and prevent excessive layout re-rendering.
 *
 * @template T - The type of the value being debounced.
 * @param {T} value - The state value to monitor and debounce.
 * @param {number} delay - The delay time in milliseconds.
 * @returns {T} The debounced state value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
