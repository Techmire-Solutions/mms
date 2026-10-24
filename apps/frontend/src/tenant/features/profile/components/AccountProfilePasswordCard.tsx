import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";
import { FormSubmitActions } from "@/components/app/FormSubmitActions";
import { useId } from "react";
import { Lock } from "lucide-react";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardTitleBar } from "@/components/app/CardTitleBar";
import { FieldErrorMessage } from "@/components/app/FormField";
import { useTranslation } from "@/hooks/useTranslation";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

export interface AccountProfilePasswordCardProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordBusy: boolean;
  showPasswordForm: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onShowPasswordForm: () => void;
  onCancelPasswordChange: () => void;
  onChangePassword: () => Promise<void>;
}

export function AccountProfilePasswordCard({
  currentPassword,
  newPassword,
  confirmPassword,
  passwordBusy,
  showPasswordForm,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onShowPasswordForm,
  onCancelPasswordChange,
  onChangePassword,
}: AccountProfilePasswordCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const id = useId();

  return (
    <Card accentColor="success" className="group/password-card">
      <CardTitleBar
        inset
        icon={<Lock className="h-4 w-4 text-primary" />}
        title={t("account.changePassword")}
        subtitle={t("account.changePassword")}
      />
      <CardContent className={cn("pt-5 space-y-4", CARD_STRIPE_INSET)}>
        {!showPasswordForm ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onShowPasswordForm}
              className="w-full min-h-11"
            >
              {t("account.changePassword")}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onChangePassword();
            }}
            className="space-y-4"
          >
            <PasswordInput
              id={`${id}-current-password`}
              name="currentPassword"
              label={t("account.currentPassword")}
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
              required
              autoComplete="current-password"
              className="min-h-11"
            />
            <div className="space-y-1">
              <PasswordInput
                id={`${id}-new-password`}
                name="newPassword"
                label={t("account.newPassword")}
                value={newPassword}
                onChange={(event) => onNewPasswordChange(event.target.value)}
                required
                autoComplete="new-password"
                className="min-h-11"
              />

              <p className="text-xs leading-snug text-muted-foreground">
                {t("account.passwordRulesHint")}
              </p>
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div className="space-y-1">
              <PasswordInput
                id={`${id}-confirm-password`}
                name="confirmPassword"
                label={t("account.confirmPassword")}
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                required
                autoComplete="new-password"
                className="min-h-11"
              />
              {newPassword && confirmPassword && newPassword === confirmPassword ? (
                <p className="text-xs mt-1 font-medium text-success">
                  {t("account.passwordSecure")}
                </p>
              ) : null}
              {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                <FieldErrorMessage message={t("account.passwordMismatch")} />
              ) : null}
            </div>
            <FormSubmitActions
              submitLabel={t("account.changePassword")}
              pending={passwordBusy}
              variant="secondary"
              disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
              cancel={{ label: t("common.cancel"), onClick: onCancelPasswordChange }}
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
