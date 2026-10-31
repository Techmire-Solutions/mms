import React, { useState } from "react";
import { Lock } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import {
  respondSessionLockOverride,
  useSessionLockOverridePrompt,
} from "@/tenant/features/sessions/hooks/sessionLockOverridePrompt";

/** Asks Sessions-setup users for a reason before saving locked changes to a started session. */
export function SessionLockOverrideDialog(): React.JSX.Element | null {
  const { t } = useTranslation();
  const prompt = useSessionLockOverridePrompt();
  const [reason, setReason] = useState("");

  // Every new prompt starts with an empty reason (render-phase reset, no effect).
  const [prevPrompt, setPrevPrompt] = useState(prompt);
  if (prevPrompt !== prompt) {
    setPrevPrompt(prompt);
    if (prompt) setReason("");
  }

  if (!prompt) return null;
  const fields = prompt.violations.map((code) => t(`sessions.lock.field.${code}`)).join(", ");

  return (
    <FormModal
      open
      onClose={() => respondSessionLockOverride(null)}
      title={t("sessions.lock.overrideTitle")}
      subtitle={t("sessions.lock.blocked", { fields })}
      icon={Lock}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("sessions.lock.override")}
      saveDisabled={reason.trim().length < 3}
      onSave={() => respondSessionLockOverride(reason.trim())}
    >
      <div className="space-y-3 text-start">
        <p className="text-sm text-muted-foreground text-pretty">
          {t("sessions.lock.overrideDescription")}
        </p>
        <Field id="session-lock-reason" label={t("sessions.lock.overrideReason")} required>
          <Textarea
            id="session-lock-reason"
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    </FormModal>
  );
}
