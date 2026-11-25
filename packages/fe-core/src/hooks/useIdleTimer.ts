import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

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
  // The rendered countdown is state-derived; refs only carry bookkeeping that
  // listeners/timers read or write outside render.
  const [now, setNow] = useState<number>(() => Date.now());
  const [deadline, setDeadline] = useState<number>(() => Date.now() + timeoutMs);

  const deadlineRef = useRef(deadline);
  const warnedRef = useRef(false);
  const timeoutFiredRef = useRef(false);
  const lastResetRef = useRef<number | null>(null);

  // Effect events always invoke the latest handlers, so a parent passing an
  // inline arrow never re-schedules the idle timers.
  const fireOnTimeout = useEffectEvent(onTimeout);
  const fireOnWarn = useEffectEvent(() => {
    onWarn?.();
  });

  // Mirror the rendered deadline for the listeners below (effect-only write).
  useEffect(() => {
    deadlineRef.current = deadline;
  }, [deadline]);

  const remainingMs = enabled ? Math.max(0, deadline - now) : timeoutMs;
  const isWarning = enabled && remainingMs <= warnBeforeMs && warnBeforeMs > 0;

  const reset = useCallback((): void => {
    const currentNow = Date.now();
    const nextDeadline = currentNow + timeoutMs;
    deadlineRef.current = nextDeadline;
    setDeadline(nextDeadline);
    warnedRef.current = false;
    timeoutFiredRef.current = false;
    lastResetRef.current = currentNow;
    setNow(currentNow);
  }, [timeoutMs]);

  // Activity listeners + window re-baseline on (re)enable or duration change.
  // The ref side re-baselines synchronously so the timer effect below never
  // reads a stale deadline; the state side is deferred one tick because this
  // effect must not set state synchronously (react-hooks/set-state-in-effect).
  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (!enabled) {
      warnedRef.current = false;
      timeoutFiredRef.current = false;
      lastResetRef.current = null;
      return;
    }

    let syncStateId: number | undefined;
    if (isFirstRunRef.current) {
      // The lazy initialisers already opened a fresh window for the mount.
      isFirstRunRef.current = false;
    } else {
      const freshDeadline = Date.now() + timeoutMs;
      deadlineRef.current = freshDeadline;
      warnedRef.current = false;
      timeoutFiredRef.current = false;
      lastResetRef.current = null;
      syncStateId = window.setTimeout(() => {
        setDeadline(freshDeadline);
        // Pair `now` with the deadline's own base time so the rendered
        // countdown reads exactly `timeoutMs` after the sync.
        setNow(freshDeadline - timeoutMs);
      }, 0);
    }

    const handleEvent = (): void => {
      const currentNow = Date.now();
      const lastReset = lastResetRef.current ?? 0;
      if (deadlineRef.current - currentNow <= warnBeforeMs || currentNow - lastReset >= 2000) {
        reset();
      }
    };

    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, handleEvent, { passive: true }));
    return () => {
      if (syncStateId !== undefined) window.clearTimeout(syncStateId);
      IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, handleEvent));
    };
  }, [enabled, timeoutMs, warnBeforeMs, reset]);

  // Schedule the next tick/timer from the freshest ref deadline. `deadline`
  // and `now` are render snapshots used purely to re-run this effect on each
  // countdown tick; decisions read the ref so a (re)enable commit — whose
  // render is one snapshot behind — can never fire a stale timeout.
  useEffect(() => {
    if (!enabled) return;

    const currentRemaining = Math.max(0, deadlineRef.current - Date.now());

    if (currentRemaining <= 0) {
      if (!timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        fireOnTimeout();
      }
      return;
    }

    if (warnBeforeMs > 0 && currentRemaining <= warnBeforeMs) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        fireOnWarn();
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
        : currentRemaining;

    const timerId = window.setTimeout(() => {
      setNow(Date.now());
    }, timeUntilWarn);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [enabled, deadline, now, warnBeforeMs]);

  return { remainingMs, isWarning, reset };
}
