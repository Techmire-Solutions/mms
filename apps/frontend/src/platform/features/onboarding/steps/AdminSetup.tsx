import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OnboardingData } from "@/platform/features/onboarding/OnboardingWizard";
import { useTranslation } from "@/hooks/useTranslation";
import { Mail } from "lucide-react";
import { DEFAULT_GLOBAL_SETTINGS, getPasswordPolicyHintKey } from "@mms/contracts";
import { Alert, CompactSegmentedControl, Field, FormSelect, Input } from "@mms/ui";
import { AuthEmailField, AuthPasswordField } from "@/components/entry";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";

/** The subset of onboarding data used by this step. */
export interface AdminSetupData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  adminGender?: string;
  adminPasswordMode?: string;
}

interface AdminSetupProps {
  data: OnboardingData;
  onChange: Dispatch<SetStateAction<OnboardingData>>;
}

const PASSWORD_MODES = [
  { value: "email" as const, labelKey: "onboarding.admin.passwordModeEmail" as const },
  { value: "temporary" as const, labelKey: "onboarding.admin.passwordModeTemporary" as const },
];

/**
 * AdminSetup step component for onboarding.
 *
 * The madrasa is created by a platform operator, so no terms acceptance is
 * collected here; the operator chooses how the super admin receives their first
 * credential (activation email vs temporary password) and the admin's gender is
 * captured for the tenant contact record.
 */
export default function AdminSetup({ data, onChange }: AdminSetupProps) {
  const { t } = useTranslation();
  const passwordMode = data.adminPasswordMode;
  const passwordHint = t(getPasswordPolicyHintKey(DEFAULT_GLOBAL_SETTINGS.passwordPolicy));

  const update = (field: keyof OnboardingData, fieldValue: unknown) => {
    onChange((prev) => ({ ...prev, [field]: fieldValue }) as OnboardingData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="firstName" label={t("onboarding.admin.firstName")} required>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            autoFocus
            required
            value={data.firstName || ""}
            onChange={(event) => update("firstName", event.target.value)}
            placeholder={t("onboarding.admin.firstNamePlaceholder")}
            className="h-11"
          />
        </Field>
        <Field id="lastName" label={t("onboarding.admin.lastName")} required>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={data.lastName || ""}
            onChange={(event) => update("lastName", event.target.value)}
            placeholder={t("onboarding.admin.lastNamePlaceholder")}
            className="h-11"
          />
        </Field>
      </div>

      <AuthEmailField
        id="email"
        label={t("onboarding.admin.email")}
        value={data.email || ""}
        placeholder={t("onboarding.admin.emailPlaceholder")}
        onChange={(value) => update("email", value)}
      />

      <Field id="gender" label={t("onboarding.admin.gender")} required>
        <FormSelect
          id="gender"
          name="gender"
          required
          value={data.adminGender || ""}
          onChange={(value) => update("adminGender", value)}
          options={[
            { value: "male", label: t("contacts.gender.male") },
            { value: "female", label: t("contacts.gender.female") },
          ]}
          placeholder={t("onboarding.admin.gender")}
          className="h-11"
        />
      </Field>

      <Field
        id="admin-password-mode"
        label={t("onboarding.admin.passwordModeLabel")}
        required
        hint={t(
          passwordMode === "temporary"
            ? "onboarding.admin.passwordModeTemporaryDesc"
            : "onboarding.admin.passwordModeEmailDesc",
        )}
      >
        <CompactSegmentedControl
          options={PASSWORD_MODES.map((mode) => ({ value: mode.value, label: t(mode.labelKey) }))}
          value={passwordMode}
          onChange={(value) => update("adminPasswordMode", value)}
          tone="card"
          layout="chips"
          fill
          ariaLabel={t("onboarding.admin.passwordModeLabel")}
        />
      </Field>

      {passwordMode === "temporary" ? (
        <div className="space-y-3">
          <AuthPasswordField
            id="admin-password"
            name="password"
            label={t("users.addTempPassword")}
            value={data.password || ""}
            onChange={(value) => update("password", value)}
            autoComplete="new-password"
            enterKeyHint="next"
            placeholder={passwordHint}
            describedBy="admin-password-policy"
          />
          <p id="admin-password-policy" className="text-xs text-muted-foreground">
            {passwordHint}
          </p>
          <PasswordStrengthMeter password={data.password || ""} showChecks />
          <AuthPasswordField
            id="admin-password-confirm"
            name="passwordConfirm"
            label={t("onboarding.admin.confirmPassword")}
            value={data.passwordConfirm || ""}
            onChange={(value) => update("passwordConfirm", value)}
            autoComplete="new-password"
            enterKeyHint="done"
          />
        </div>
      ) : (
        <Alert icon={Mail} tone="info" description={t("onboarding.admin.passwordEmailNotice")} />
      )}
    </div>
  );
}
