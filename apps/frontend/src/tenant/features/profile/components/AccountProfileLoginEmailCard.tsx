import { useId } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import type { TenantUserProfile } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardTitleBar } from "@/components/ui/CardTitleBar";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormSubmitActions } from "@/components/ui/FormSubmitActions";
import { WarningCallout } from "@/components/ui/WarningCallout";
import { useTranslation } from "@/hooks/useTranslation";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";

export interface AccountProfileLoginEmailCardProps {
  profile: TenantUserProfile;
  loginVerified: boolean;
  newLoginEmail: string;
  loginPassword: string;
  challengeId: string | null;
  verifyCode: string;
  devCode: string | null;
  loginEmailBusy: boolean;
  showEmailForm: boolean;
  onNewLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onVerifyCodeChange: (value: string) => void;
  onShowEmailForm: () => void;
  onCancelLoginEmailRequest: () => void;
  onCancelLoginEmailConfirm: () => void;
  onRequestLoginEmail: () => Promise<void>;
  onConfirmLoginEmail: () => Promise<void>;
}

export function AccountProfileLoginEmailCard({
  profile,
  loginVerified,
  newLoginEmail,
  loginPassword,
  challengeId,
  verifyCode,
  devCode,
  loginEmailBusy,
  showEmailForm,
  onNewLoginEmailChange,
  onLoginPasswordChange,
  onVerifyCodeChange,
  onShowEmailForm,
  onCancelLoginEmailRequest,
  onCancelLoginEmailConfirm,
  onRequestLoginEmail,
  onConfirmLoginEmail,
}: AccountProfileLoginEmailCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const id = useId();

  return (
    <Card accentColor="primary" className="group/login-card">
      <CardTitleBar
        inset
        icon={<Mail className="h-4 w-4 text-primary" />}
        title={t("account.loginSection")}
        subtitle={t("account.loginSectionDesc")}
      />
      <CardContent className={cn("pt-5 space-y-4", CARD_STRIPE_INSET)}>
        <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border/30 rounded-xl text-sm">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 text-start break-words">
            <p className="text-xs text-muted-foreground font-medium">{t("account.loginEmail")}</p>
            <p className="font-semibold text-foreground mt-0.5">{profile.loginEmail}</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-1">
          {loginVerified ? (
            <p className="flex items-center gap-1.5 text-xs text-success font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {t("account.emailVerified")}
            </p>
          ) : (
            <p className="text-xs text-warning font-semibold">{t("account.emailNotVerified")}</p>
          )}
        </div>

        {profile.pendingLoginEmail ? (
          <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border/55">
            {t("account.pendingLoginEmail", { email: profile.pendingLoginEmail })}
          </p>
        ) : null}

        <div className="space-y-4 border-t border-border pt-4 mt-2">
          {!showEmailForm && !challengeId ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onShowEmailForm}
                className="w-full min-h-11"
              >
                {t("account.changeLoginEmail")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-foreground mb-1">
                {t("account.changeLoginEmail")}
              </p>
              {!challengeId ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onRequestLoginEmail();
                  }}
                  className="space-y-4"
                >
                  <Field id={`${id}-new-login-email`} label={t("account.newLoginEmail")} required>
                    <Input
                      id={`${id}-new-login-email`}
                      name="newLoginEmail"
                      type="email"
                      value={newLoginEmail}
                      onChange={(event) => onNewLoginEmailChange(event.target.value)}
                      required
                      autoComplete="email"
                      className="min-h-11"
                    />
                  </Field>
                  <PasswordInput
                    id={`${id}-password`}
                    name="loginPassword"
                    label={t("account.currentPassword")}
                    value={loginPassword}
                    onChange={(event) => onLoginPasswordChange(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <FormSubmitActions
                    submitLabel={t("account.sendCode")}
                    pending={loginEmailBusy}
                    variant="secondary"
                    disabled={!newLoginEmail.trim() || !loginPassword}
                    cancel={{ label: t("common.cancel"), onClick: onCancelLoginEmailRequest }}
                  />
                </form>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onConfirmLoginEmail();
                  }}
                  className="space-y-4 pt-2"
                >
                  {devCode ? (
                    <WarningCallout
                      tone="info"
                      density="compact"
                      description={t("account.devCodeHint", { code: devCode })}
                    />
                  ) : null}
                  <Field
                    id={`${id}-login-email-code`}
                    label={t("account.verificationCode")}
                    required
                  >
                    <Input
                      id={`${id}-login-email-code`}
                      name="verifyCode"
                      inputMode="numeric"
                      value={verifyCode}
                      onChange={(event) => onVerifyCodeChange(event.target.value)}
                      required
                      autoComplete="one-time-code"
                      className="min-h-11"
                    />
                  </Field>
                  <FormSubmitActions
                    submitLabel={t("account.confirmLoginEmail")}
                    pending={loginEmailBusy}
                    variant="primary"
                    disabled={!verifyCode.trim()}
                    cancel={{ label: t("common.cancel"), onClick: onCancelLoginEmailConfirm }}
                  />
                </form>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
