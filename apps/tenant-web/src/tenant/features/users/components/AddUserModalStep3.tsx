import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { getPasswordPolicyHintKey } from "@mms/contracts";
import { Button } from "@mms/ui";
import { CheckboxField } from "@mms/ui";
import { Input as UiInput } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FORM_LABEL } from "@mms/ui";
import type { AddUserStepProps } from "../lib/addUserModalTypes";

const SETUP_OPTIONS = [
  {
    id: "invite",
    labelKey: "users.addMethodInvite" as const,
    descKey: "users.addMethodInviteDesc" as const,
    icon: Mail,
  },
  {
    id: "password",
    labelKey: "users.addMethodPassword" as const,
    descKey: "users.addMethodPasswordDesc" as const,
    icon: Lock,
  },
] as const;

export function Step3({ form, setForm, errors }: AddUserStepProps): JSX.Element {
  const { t } = useTranslation();
  const [showPwd, setShowPwd] = useState(false);
  const globalSettings = useGlobalSettings();
  const passwordHint = t(getPasswordPolicyHintKey(globalSettings.passwordPolicy));

  return (
    <div className="space-y-4">
      <div>
        <p className={FORM_LABEL}>{t("users.addAccountMethod")}</p>
        <div className="grid grid-cols-1 gap-2 mt-1 sm:grid-cols-2">
          {SETUP_OPTIONS.map((setupOption) => {
            const Icon = setupOption.icon;
            const active = form.setupMethod === setupOption.id;
            return (
              <Button
                type="button"
                variant="ghost"
                key={setupOption.id}
                onClick={() =>
                  setForm((previousForm) => ({ ...previousForm, setupMethod: setupOption.id }))
                }
                className={`p-3 rounded-xl border-2 text-start transition-all h-auto flex flex-col items-start shadow-none ${
                  active
                    ? "border-primary bg-primary/5 hover:bg-primary/5 text-foreground"
                    : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon
                    className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-xs font-bold ${active ? "text-primary" : "text-foreground"}`}
                  >
                    {t(setupOption.labelKey)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t(setupOption.descKey)}
                </p>
              </Button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {form.setupMethod === "invite" && (
          <m.div
            key="invite"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border bg-muted/40 p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">{t("users.addInviteTitle")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("users.addInviteBody", { email: form.email || "…" })}
            </p>
            <p className="text-xs text-muted-foreground">{t("users.addInvitePending")}</p>
          </m.div>
        )}

        {form.setupMethod === "password" && (
          <m.div
            key="password"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Field
              id="add-user-temp-password"
              label={t("users.addTempPassword")}
              required
              error={errors.password}
              hint={passwordHint}
            >
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <UiInput
                  id="add-user-temp-password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  placeholder={passwordHint}
                  value={form.password || ""}
                  onChange={(event) =>
                    setForm((previousForm) => ({ ...previousForm, password: event.target.value }))
                  }
                  className="ps-9.5 pe-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPwd((visible) => !visible)}
                  aria-label={showPwd ? t("auth.hidePassword") : t("auth.showPassword")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-11 min-w-11 hover:bg-transparent shadow-none"
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </Field>

            <CheckboxField
              id="add-user-force-reset"
              name="forceReset"
              checked={form.forceReset !== false}
              onCheckedChange={(checked) =>
                setForm((previousForm) => ({ ...previousForm, forceReset: !!checked }))
              }
              label={t("users.addForceReset")}
            />
          </m.div>
        )}
      </AnimatePresence>

      <div className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
        <CheckboxField
          id="add-user-2fa"
          name="twoFactorEnabled"
          checked={!!form.twoFactorEnabled}
          onCheckedChange={(checked) =>
            setForm((previousForm) => ({ ...previousForm, twoFactorEnabled: !!checked }))
          }
          label={t("users.add2faTitle")}
          description={t("users.add2faDesc")}
        />
      </div>
    </div>
  );
}
