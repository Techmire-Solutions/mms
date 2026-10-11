import React from "react";
import { Clock, LogOut, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";

interface SessionTimeoutModalProps {
  open: boolean;
  /** Milliseconds remaining before the idle deadline. */
  remainingMs: number;
  onExtend: () => void;
  onSignOut: () => void;
  busy?: boolean;
}

/**
 * Countdown warning shown shortly before a tenant or platform session times out.
 * Lets the user "stay signed in" (sliding extension) or sign out immediately.
 *
 * Built on the shared {@link Modal} so it inherits the focus trap, initial focus,
 * body scroll lock and the token-backed backdrop — it previously hand-rolled its
 * own overlay and had none of those, while still declaring `aria-modal="true"`.
 *
 * It is deliberately NON-dismissible: a user who dismissed it with Escape could
 * carry on working against a session that is about to expire. `priority` lifts it
 * above any modal that happened to be open when the deadline approached.
 */
export function SessionTimeoutModal({
  open,
  remainingMs,
  onExtend,
  onSignOut,
  busy = false,
}: SessionTimeoutModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!open) return null;

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <Modal
      open={open}
      onClose={onSignOut}
      title={t("session.timeoutTitle")}
      subtitle={t("session.timeoutDesc")}
      icon={Clock}
      size="sm"
      priority
      dismissible={false}
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button type="button" size="lg" onClick={onExtend} disabled={busy} className="w-full">
            <TimerReset className="h-4 w-4" aria-hidden />
            {t("session.staySignedIn")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onSignOut}
            disabled={busy}
            className="w-full"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t("session.signOutNow")}
          </Button>
        </div>
      }
    >
      <p
        className="text-center text-sm font-medium text-foreground"
        role="status"
        aria-live="polite"
      >
        {t("session.timeoutCountdown", { seconds: String(seconds) })}
      </p>
    </Modal>
  );
}
