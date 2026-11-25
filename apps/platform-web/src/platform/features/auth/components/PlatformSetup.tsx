import React from "react";
import { EntryPageHead } from "@/components/entry";
import { PlatformSetupRegisterForm } from "@/platform/features/auth/components/PlatformSetupRegisterForm";
import { usePlatformSetupController } from "@/platform/features/auth/usePlatformSetupController";

interface PlatformSetupProps {
  smtpConfigured: boolean;
}

/**
 * First-run wizard to create the initial platform super-user account.
 */
export default function PlatformSetup({ smtpConfigured }: PlatformSetupProps): React.JSX.Element {
  const controller = usePlatformSetupController(smtpConfigured);

  return (
    <>
      <EntryPageHead
        title={controller.pageTitle}
        description={controller.t("entry.meta.platformSetup")}
      />
      <PlatformSetupRegisterForm
        t={controller.t}
        smtpConfigured={smtpConfigured}
        name={controller.name}
        setName={controller.setName}
        email={controller.email}
        setEmail={controller.setEmail}
        password={controller.password}
        setPassword={controller.setPassword}
        error={controller.error}
        loading={controller.loading}
        onRegister={controller.handleRegister}
        onClearError={controller.clearError}
      />
    </>
  );
}
