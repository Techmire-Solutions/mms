import { useEffect, useRef, useState } from "react";

export interface UseIdleTimerOptions {
  enabled: boolean;
  timeoutMs: number;
  /** Show the warning and call `onWarn` this long before the deadline (ms). */
  warnBeforeMs?: number;
  onWarn?: () => void;
  onTimeout: () => void;
}

export interface IdleTimerState {
  /** Milliseconds remaining until the idle deadline (0 when expired). */
  remainingMs: number;
  /** True once we are inside the warning window (deadline <= warnBeforeMs). */
  isWarning: boolean;
  /** Manually restart the idle window (used by "stay signed in"). */
  reset: () => void;
}

const IDLE_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/**
 * Server-aware inactivity timer. Returns the remaining idle time (ticked every
 * second) so the UI can render a countdown, and calls `onWarn` when entering the
 * warning window and `onTimeout` when the deadline expires. Any tracked user
 * activity restarts the idle window.
 */
export function useIdleTimer({
  enabled,
  timeoutMs,
  warnBeforeMs = 0,
  onWarn,
  onTimeout,
}: UseIdleTimerOptions): IdleTimerState {
  const [now, setNow] = useState(() => Date.now());
  const deadlineRef = useRef<number>(Date.now() + timeoutMs);
  const warnedRef = useRef(false);
  const timeoutFiredRef = useRef(false);
  const lastResetRef = useRef<number>(Date.now());

  const onTimeoutRef = useRef(onTimeout);
  const onWarnRef = useRef(onWarn);
  onTimeoutRef.current = onTimeout;
  onWarnRef.current = onWarn;

  const remainingMs = enabled ? Math.max(0, deadlineRef.current - now) : timeoutMs;
  const isWarning = enabled && remainingMs <= warnBeforeMs && warnBeforeMs > 0;

  const reset = (): void => {
    const currentNow = Date.now();
    deadlineRef.current = currentNow + timeoutMs;
    warnedRef.current = false;
    timeoutFiredRef.current = false;
    lastResetRef.current = currentNow;
    setNow(currentNow);
  };

  useEffect(() => {
    if (!enabled) {
      deadlineRef.current = Date.now() + timeoutMs;
      warnedRef.current = false;
      timeoutFiredRef.current = false;
      return;
    }

    const handleEvent = (): void => {
      const currentNow = Date.now();
      if (
        deadlineRef.current - currentNow <= warnBeforeMs ||
        currentNow - lastResetRef.current >= 2000
      ) {
        reset();
      }
    };

    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, handleEvent, { passive: true }));
    reset();

    return () => {
      IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, handleEvent));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMs, warnBeforeMs]);

  useEffect(() => {
    if (!enabled) return;

    if (remainingMs <= 0) {
      if (!timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        onTimeoutRef.current();
      }
      return;
    }

    if (isWarning) {
      if (!warnedRef.current && onWarnRef.current) {
        warnedRef.current = true;
        onWarnRef.current();
      }
      const intervalId = window.setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => {
        window.clearInterval(intervalId);
      };
    }

    const timeUntilWarn =
      warnBeforeMs > 0
        ? Math.max(0, deadlineRef.current - warnBeforeMs - Date.now())
        : Math.max(0, deadlineRef.current - Date.now());

    const timerId = window.setTimeout(() => {
      setNow(Date.now());
    }, timeUntilWarn);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [enabled, remainingMs, isWarning, warnBeforeMs]);

  return { remainingMs, isWarning, reset };
}
