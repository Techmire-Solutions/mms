import React, { useState } from "react";
import { Mail, User, UserPlus, ShieldPlus } from "lucide-react";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS, type PlatformAdminPermissions } from "@mms/shared";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/button";
import { LeadingIconInput } from "@/components/ui/LeadingIconInput";
import { FormModal } from "@/components/ui/FormModal";
import { Field } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { getPlatformRegisterError } from "@/platform/lib/platformValidation";
import { useAddPlatformAdmin } from "@/platform/hooks/usePlatformAdmins";
import { PlatformAdminPermissionsFields } from "@/platform/components/PlatformAdminPermissionsFields";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

export function PlatformAddAdminForm({
  asTriggerOnly = false,
}: { asTriggerOnly?: boolean } = {}): React.JSX.Element {
  const { t } = useTranslation();
  const addAdmin = useAddPlatformAdmin();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("create") === "true";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [permissions, setPermissions] = useState<PlatformAdminPermissions>(
    DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetForm = (): void => {
    setName("");
    setEmail("");
    setPassword("");
    setCurrentPassword("");
    setPermissions(DEFAULT_PLATFORM_ADMIN_PERMISSIONS);
    setSubmitError(null);
  };

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) {
      resetForm();
      if (typeof window !== "undefined" && window.location.search.includes("create=")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("create");
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      }
    }
  };

  const handleSave = async (): Promise<void> => {
    setSubmitError(null);

    const validationError = getPlatformRegisterError(name, email, password, t);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (!currentPassword.trim()) {
      setSubmitError(t("platform.validationConfirmPlatformPassword"));
      return;
    }

    try {
      await addAdmin.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        currentPassword,
        permissions,
      });
      handleOpenChange(false);
    } catch (err) {
      setSubmitError(getPlatformErrorMessage(err, t));
    }
  };

  const content = (
    <>
      <Button
        variant="primary"
        icon={UserPlus}
        className={asTriggerOnly ? undefined : "w-full"}
        onClick={() => setOpen(true)}
      >
        {t("platform.addAdmin")}
      </Button>

      <FormModal
        open={open}
        onClose={() => handleOpenChange(false)}
        title={t("platform.addAdmin")}
        icon={UserPlus}
        size="md"
        error={submitError ?? undefined}
        cancelLabel={t("common.cancel")}
        saveLabel={t("platform.addAdmin")}
        onSave={handleSave}
        saving={addAdmin.isPending}
        dir="ltr"
        lang="en"
        formId="platform-add-admin-form"
      >
        <form
          id="platform-add-admin-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          className="space-y-4 text-start"
        >
          {/* Full Name Field */}
          <Field label={t("platform.adminName")} required id="admin-name">
            <LeadingIconInput
              id="admin-name"
              name="adminName"
              type="text"
              icon={User}
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (submitError) setSubmitError(null);
              }}
              className="min-h-11 rounded-xl"
              disabled={addAdmin.isPending}
              placeholder={t("platform.setupFullName")}
            />
          </Field>

          {/* Email Address Field */}
          <Field label={t("platform.adminEmail")} required id="admin-email">
            <LeadingIconInput
              id="admin-email"
              name="adminEmail"
              type="email"
              icon={Mail}
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (submitError) setSubmitError(null);
              }}
              className="min-h-11 rounded-xl"
              disabled={addAdmin.isPending}
              placeholder={t("auth.emailPlaceholder")}
            />
          </Field>

          {/* Password Field & Real-time Strength Bar */}
          <div className="space-y-2">
            <PasswordInput
              id="admin-password"
              name="adminPassword"
              label={t("platform.adminPassword")}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (submitError) setSubmitError(null);
              }}
              disabled={addAdmin.isPending}
            />

            <PasswordStrengthMeter password={password} />
          </div>

          <PasswordInput
            id="admin-operator-password"
            name="platformPassword"
            label={t("platform.confirmPlatformPassword")}
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              if (submitError) setSubmitError(null);
            }}
            disabled={addAdmin.isPending}
            placeholder={t("platform.confirmPlatformPasswordHint")}
          />

          {/* Capability Flags */}
          <PlatformAdminPermissionsFields
            value={permissions}
            onChange={setPermissions}
            disabled={addAdmin.isPending}
          />
        </form>
      </FormModal>
    </>
  );

  if (asTriggerOnly) {
    return content;
  }

  return (
    <SectionCard
      title={t("platform.addAdmin")}
      subtitle={t("platform.addAdminSubtitle")}
      icon={ShieldPlus}
      accentColor="primary"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("platform.addAdminCardDesc")}
        </p>
        {content}
      </div>
    </SectionCard>
  );
}
