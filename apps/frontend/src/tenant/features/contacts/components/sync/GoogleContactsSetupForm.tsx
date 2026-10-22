import type React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldErrorMessage } from "@/components/app/FormField";
import { FORM_ERROR_BOX } from "@/components/ui/formStyles";
import { WarningCallout } from "@/components/app/WarningCallout";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface GoogleContactsSetupHintProps {
  t: TranslationFunction;
}

export function GoogleContactsSetupHint({ t }: GoogleContactsSetupHintProps): React.JSX.Element {
  return (
    <WarningCallout
      icon={AlertCircle}
      density="compact"
      role="status"
      className="gap-3 p-3 text-warning"
      title={t("contacts.sync.oauthSetupTitle")}
      description={t("contacts.sync.oauthSetupDesc")}
    />
  );
}

export interface GoogleContactsSetupFormProps {
  clientId: string;
  clientSecret: string;
  error: string;
  onClientIdChange: (value: string) => void;
  onClientSecretChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  t: TranslationFunction;
}

export function GoogleContactsSetupForm({
  clientId,
  clientSecret,
  error,
  onClientIdChange,
  onClientSecretChange,
  onSave,
  onCancel,
  t,
}: GoogleContactsSetupFormProps): React.JSX.Element {
  return (
    <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border">
      <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
        {t("contacts.sync.oauthHeader")}
      </h4>
      <Field id="clientId" label={t("contacts.sync.clientIdLabel")}>
        <Input
          id="clientId"
          value={clientId}
          onChange={(event) => onClientIdChange(event.target.value)}
          placeholder={t("contacts.sync.clientIdPlaceholder")}
        />
      </Field>
      <Field id="clientSecret" label={t("contacts.sync.clientSecretLabel")}>
        <Input
          id="clientSecret"
          type="password"
          value={clientSecret}
          onChange={(event) => onClientSecretChange(event.target.value)}
          placeholder={t("contacts.sync.clientSecretPlaceholder")}
        />
      </Field>
      <FieldErrorMessage message={error || undefined} className={FORM_ERROR_BOX} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={!clientId.trim() || !clientSecret.trim()}
          className="px-4 font-bold shadow-none"
        >
          {t("contacts.sync.saveCredentials")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="px-4 font-medium shadow-none"
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
