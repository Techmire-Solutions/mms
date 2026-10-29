import { useEffect, useState } from "react";

/** Countdown timer for OTP resend buttons (seconds). Pass `cycle` to restart after resend. */
export function useResendCountdown(active: boolean, seconds = 30, cycle = 0): number {
  const [remaining, setRemaining] = useState(seconds);
  const [source, setSource] = useState({ active, seconds, cycle });

  // Restart the countdown when the caller asks for a new cycle. Adjusting state
  // during render (React's documented prop-change pattern) avoids the extra
  // effect commit and the frame where the old countdown is still visible.
  if (source.active !== active || source.seconds !== seconds || source.cycle !== cycle) {
    setSource({ active, seconds, cycle });
    if (active) setRemaining(seconds);
  }

  useEffect(() => {
    if (!active || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [active, remaining]);

  return remaining;
}
