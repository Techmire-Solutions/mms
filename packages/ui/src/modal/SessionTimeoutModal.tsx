import * as React from "react";
import { Clock, LogOut, TimerReset } from "lucide-react";
import { Button } from "../button/Button";
import { Modal } from "./Modal";

export interface SessionTimeoutModalProps {
  open: boolean;
  /** Milliseconds remaining before the idle deadline. */
  remainingMs: number;
  onExtend: () => void;
  onSignOut: () => void;
  busy?: boolean;
  title?: string;
  subtitle?: string;
  staySignedInLabel?: string;
  signOutNowLabel?: string;
  countdownMessage?: string | ((seconds: number) => string);
}

/**
 * Countdown warning modal shown before a session times out.
 * Lets the user extend their session or sign out immediately.
 */
export function SessionTimeoutModal({
  open,
  remainingMs,
  onExtend,
  onSignOut,
  busy = false,
  title = "Session Timeout Warning",
  subtitle = "Your session is about to expire due to inactivity.",
  staySignedInLabel = "Stay Signed In",
  signOutNowLabel = "Sign Out Now",
  countdownMessage,
}: SessionTimeoutModalProps): React.JSX.Element | null {
  if (!open) return null;

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const resolvedCountdown =
    typeof countdownMessage === "function"
      ? countdownMessage(seconds)
      : (countdownMessage ??
        `Your session will expire in ${seconds} second${seconds === 1 ? "" : "s"}.`);

  return (
    <Modal
      open={open}
      onClose={onSignOut}
      title={title}
      subtitle={subtitle}
      icon={Clock}
      size="sm"
      priority
      dismissible={false}
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button
            type="button"
            size="lg"
            onClick={onExtend}
            disabled={busy}
            className="w-full cursor-pointer"
          >
            <TimerReset className="h-4 w-4" aria-hidden="true" />
            {staySignedInLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onSignOut}
            disabled={busy}
            className="w-full cursor-pointer"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signOutNowLabel}
          </Button>
        </div>
      }
    >
      <p
        className="text-center text-sm font-medium text-foreground text-balance"
        role="status"
        aria-live="polite"
      >
        {resolvedCountdown}
      </p>
    </Modal>
  );
}
