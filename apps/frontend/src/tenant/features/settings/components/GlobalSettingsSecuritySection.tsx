import React from "react";
import { Lock } from "lucide-react";
import {
  getPasswordPolicyHintKey,
  normalizePasswordPolicy,
  normalizeSessionTimeout,
  parseSessionTimeoutMinutes,
  SESSION_TIMEOUT_PRESETS,
  type AppTranslationKey,
  type PasswordPolicyLevel,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  SettingsCallout,
  SettingsFieldGroup,
  SettingsToggleRow,
} from "@/components/ui/SettingsShell";
import type { GlobalSettings } from "@mms/shared";
import { Badge } from "@/components/ui/badge";

interface GlobalSettingsSecuritySectionProps {
  data: GlobalSettings;
  upd: <K extends keyof GlobalSettings>(field: K, value: GlobalSettings[K]) => void;
}

export function GlobalSettingsSecuritySection({
  data,
  upd,
}: GlobalSettingsSecuritySectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const passwordPolicy = normalizePasswordPolicy(data.passwordPolicy);
  const sessionMinutes = parseSessionTimeoutMinutes(data.sessionTimeout);

  const policyLabelKey: Record<PasswordPolicyLevel, AppTranslationKey> = {
    basic: "global.passwordPolicyBasic",
    medium: "global.passwordPolicyMedium",
    strong: "global.passwordPolicyStrong",
  };

  return (
    <SectionCard title={t("global.security")} subtitle={t("global.securityDesc")} icon={Lock}>
      <div className="space-y-4">
        <SettingsCallout>{t("global.securityNote")}</SettingsCallout>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
          <span className="text-muted-foreground">{t("global.securityActiveConfig")}:</span>
          <Badge as="span" tone={data.twoFactor ? "primary" : "muted"} size="sm">
            {data.twoFactor ? t("global.security2faOn") : t("global.security2faOff")}
          </Badge>
          <Badge as="span" tone="muted" size="sm">
            {t("global.securitySessionBadge", { minutes: sessionMinutes })}
          </Badge>
          <Badge as="span" tone="muted" size="sm">
            {t(policyLabelKey[passwordPolicy])}
          </Badge>
        </div>
        <SettingsToggleRow
          id="twoFactor"
          label={t("global.twoFactor")}
          description={t("global.twoFactorDesc")}
          checked={Boolean(data.twoFactor)}
          onCheckedChange={(v) => upd("twoFactor", v)}
        />
        <SettingsFieldGroup>
          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">{t("global.sessionTimeout")}</Label>
            <FormSelect
              id="sessionTimeout"
              name="sessionTimeout"
              value={normalizeSessionTimeout(data.sessionTimeout)}
              onChange={(v) => upd("sessionTimeout", normalizeSessionTimeout(v))}
              options={SESSION_TIMEOUT_PRESETS.map((preset) => ({
                value: preset.value,
                label: t(preset.labelKey),
              }))}
            />
            <p className="text-xs text-muted-foreground">{t("global.sessionTimeoutNote")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordPolicy">{t("global.passwordPolicy")}</Label>
            <FormSelect
              id="passwordPolicy"
              name="passwordPolicy"
              value={passwordPolicy}
              onChange={(v) => upd("passwordPolicy", normalizePasswordPolicy(v))}
              options={[
                { value: "basic", label: t("global.passwordPolicyBasic") },
                { value: "medium", label: t("global.passwordPolicyMedium") },
                { value: "strong", label: t("global.passwordPolicyStrong") },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t(getPasswordPolicyHintKey(passwordPolicy))}
            </p>
            <p className="text-xs text-muted-foreground">{t("global.passwordPolicyNote")}</p>
          </div>
        </SettingsFieldGroup>
      </div>
    </SectionCard>
  );
}
