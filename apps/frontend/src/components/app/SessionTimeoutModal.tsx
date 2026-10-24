import React from "react";
import {
  SessionTimeoutModal as SharedSessionTimeoutModal,
  type SessionTimeoutModalProps as SharedSessionTimeoutModalProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type SessionTimeoutModalProps = SharedSessionTimeoutModalProps;

/**
 * Session timeout modal facade — adapts @shared/ui SessionTimeoutModal
 * with localized copy from useTranslation().
 */
export function SessionTimeoutModal({
  title,
  subtitle,
  staySignedInLabel,
  signOutNowLabel,
  countdownMessage,
  ...props
}: SessionTimeoutModalProps): React.JSX.Element | null {
  const { t } = useTranslation();

  return (
    <SharedSessionTimeoutModal
      title={title ?? t("session.timeoutTitle")}
      subtitle={subtitle ?? t("session.timeoutDesc")}
      staySignedInLabel={staySignedInLabel ?? t("session.staySignedIn")}
      signOutNowLabel={signOutNowLabel ?? t("session.signOutNow")}
      countdownMessage={
        countdownMessage ??
        ((seconds: number) => t("session.timeoutCountdown", { seconds: String(seconds) }))
      }
      {...props}
    />
  );
}
