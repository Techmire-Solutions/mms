import type React from "react";
import { ExternalLink, Globe, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldErrorMessage } from "@/components/ui/FormField";
import { FORM_ERROR_BOX } from "@/components/ui/formStyles";
import { WarningCallout } from "@/components/ui/WarningCallout";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

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
        className="flex min-h-11 w-full items-center justify-start gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-none transition-colors hover:bg-muted"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span>{t("contacts.sync.connectGoogle")}</span>
        <ExternalLink className="ms-auto h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {showAuthCode && (
        <WarningCallout tone="info" density="compact" icon={Link2}>
          <div className="space-y-2">
            <Field id="authCode" label={t("contacts.sync.pasteAuthCode")}>
              <Input
                id="authCode"
                value={authCode}
                onChange={(event) => onAuthCodeChange(event.target.value)}
                placeholder={t("contacts.sync.pasteAuthCodePlaceholder")}
              />
            </Field>
            <Button
              type="button"
              onClick={onExchangeCode}
              disabled={!authCode.trim() || exchanging}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-transparent bg-info px-4 text-xs font-bold text-info-foreground shadow-none transition-colors hover:bg-info/90 disabled:opacity-60"
            >
              {exchanging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              <span>{t("contacts.sync.confirmAuth")}</span>
            </Button>
          </div>
        </WarningCallout>
      )}

      <FieldErrorMessage message={!showAuthCode ? error : undefined} className={FORM_ERROR_BOX} />
    </div>
  );
}
