import type React from "react";
import { ExternalLink, Globe, Link2, Loader2 } from "lucide-react";
import { Button } from "@mms/ui";
import { Input } from "@mms/ui";
import { Field, FieldErrorMessage } from "@mms/ui";
import { FORM_ERROR_BOX } from "@mms/ui";
import { Alert } from "@mms/ui";
import type { TranslationFunction } from "@mms/fe-core/i18n";

export interface GoogleContactsConnectStepProps {
  showAuthCode: boolean;
  authCode: string;
  exchanging: boolean;
  error: string;
  onConnect: () => void;
  onAuthCodeChange: (value: string) => void;
  onExchangeCode: () => void;
  t: TranslationFunction;
}

export function GoogleContactsConnectStep({
  showAuthCode,
  authCode,
  exchanging,
  error,
  onConnect,
  onAuthCodeChange,
  onExchangeCode,
  t,
}: GoogleContactsConnectStepProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("contacts.sync.credentialsSaved")}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onConnect}
        className="flex min-h-11 w-full items-center justify-start gap-2 px-4 text-sm font-semibold text-foreground shadow-none"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span>{t("contacts.sync.connectGoogle")}</span>
        <ExternalLink className="ms-auto h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {showAuthCode && (
        <Alert tone="info" density="compact" icon={Link2}>
          <div className="space-y-2">
            <Field id="authCode" label={t("contacts.sync.pasteAuthCode")}>
              <Input
                id="authCode"
                name="googleAuthCode"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "google-auth-code-error" : undefined}
                value={authCode}
                onChange={(event) => onAuthCodeChange(event.target.value)}
                placeholder={t("contacts.sync.pasteAuthCodePlaceholder")}
              />
            </Field>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onExchangeCode}
              disabled={!authCode.trim() || exchanging}
              className="gap-2 font-bold shadow-none"
            >
              {exchanging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              <span>{t("contacts.sync.confirmAuth")}</span>
            </Button>
          </div>
        </Alert>
      )}

      <FieldErrorMessage
        id="google-auth-code-error"
        message={error || undefined}
        className={FORM_ERROR_BOX}
      />
    </div>
  );
}
