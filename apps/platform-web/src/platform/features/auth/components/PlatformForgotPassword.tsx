import React from "react";
import { EntryPageHead, formatEntryTitle } from "@/components/entry";
import { usePlatformForgotPasswordController } from "@/platform/features/auth/usePlatformForgotPasswordController";
import { PlatformForgotPasswordResetStep } from "@/platform/features/auth/components/PlatformForgotPasswordResetStep";
import { PlatformForgotPasswordSentStep } from "@/platform/features/auth/components/PlatformForgotPasswordSentStep";
import { PlatformForgotPasswordRequestStep } from "@/platform/features/auth/components/PlatformForgotPasswordRequestStep";

/**
 * Apex-only forgot password for platform super-users (email OTP + new password).
 */
export default function PlatformForgotPassword(): React.JSX.Element {
  const controller = usePlatformForgotPasswordController();
  const { t, isResetStep, sent, forgotTitle } = controller;

  const pageHead = (
    <EntryPageHead
      title={formatEntryTitle(forgotTitle, t("entry.productName"))}
      description={t("entry.meta.platformForgot")}
    />
  );

  if (isResetStep) {
    return (
      <>
        {pageHead}
        <PlatformForgotPasswordResetStep controller={controller} />
      </>
    );
  }

  if (sent) {
    return (
      <>
        {pageHead}
        <PlatformForgotPasswordSentStep controller={controller} />
      </>
    );
  }

  return (
    <>
      {pageHead}
      <PlatformForgotPasswordRequestStep controller={controller} />
    </>
  );
}
