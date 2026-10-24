import React from "react";
import { User } from "lucide-react";
import {
  AuthEmailField,
  AuthPasswordField,
  AuthStatusBanner,
  AuthSubmitButton,
  AuthTextField,
} from "@/components/entry";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";
import PlatformAuthLayout from "@/platform/components/PlatformAuthLayout";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface PlatformSetupRegisterFormProps {
  t: TranslationFunction;
  smtpConfigured: boolean;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string | null;
  loading: boolean;
  onRegister: (event: React.FormEvent) => Promise<void>;
  onClearError: () => void;
}

export function PlatformSetupRegisterForm({
  t,
  smtpConfigured: _smtpConfigured,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  onRegister,
  onClearError,
}: PlatformSetupRegisterFormProps): React.JSX.Element {
  return (
    <PlatformAuthLayout title={t("platform.setupTitle")} subtitle={t("platform.setupSubtitle")}>
      <form
        onSubmit={(event) => void onRegister(event)}
        className="space-y-4"
        noValidate
        aria-busy={loading}
      >
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">
            👑
          </div>
          <div className="text-xs min-w-0">
            <p className="font-bold text-foreground">{t("platform.setupNoticeTitle")}</p>
            <p className="text-muted-foreground truncate">{t("platform.setupNoticeDesc")}</p>
          </div>
        </div>

        {error ? <AuthStatusBanner message={error} /> : null}

        <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <AuthTextField
            id="platform-setup-name"
            label={t("platform.setupFullName")}
            value={name}
            autoFocus
            autoComplete="name"
            icon={User}
            onChange={(value) => {
              setName(value);
              onClearError();
            }}
          />

          <AuthEmailField
            id="platform-setup-email"
            label={t("auth.emailAddress")}
            value={email}
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            onChange={(value) => {
              setEmail(value);
              onClearError();
            }}
          />

          <div>
            <AuthPasswordField
              id="platform-setup-password"
              label={t("auth.password")}
              autoComplete="new-password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                onClearError();
              }}
            />
            <PasswordStrengthMeter password={password} showChecks />
          </div>

          <AuthSubmitButton
            busy={loading}
            busyLabel={t("common.save")}
            label={t("platform.setupCreateAccount")}
          />
        </fieldset>
      </form>
    </PlatformAuthLayout>
  );
}
