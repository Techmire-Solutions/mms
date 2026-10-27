import type React from "react";
import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import type { ContactPreferences } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/app/SectionCard";
import { Field, FormCheckboxCard } from "@/components/app/FormPrimitives";
import { FORM_INPUT, FORM_LABEL, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { getDuplicateFieldLabel } from "@/lib/contacts/contactI18n";

/** Toggleable duplicate-detection fields (subset of the canonical field-id set). */
const DUPLICATE_DETECTION_FIELD_IDS = ["name", "phone", "email", "cnic"] as const;

export interface ContactsPreferencesDuplicateSectionProps {
  prefs: ContactPreferences;
  isPrefsDirty?: boolean;
  onUpdatePreference: <K extends keyof ContactPreferences>(
    key: K,
    value: ContactPreferences[K],
  ) => void;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function ContactsPreferencesDuplicateSection({
  prefs,
  isPrefsDirty,
  onUpdatePreference,
  saving,
  saved,
  onSave,
}: ContactsPreferencesDuplicateSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const detectionFields = prefs.duplicateDetectionFields ?? ["name", "phone", "email", "cnic"];

  const [namePrefixesDraft, setNamePrefixesDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!isPrefsDirty) {
      setNamePrefixesDraft(null);
    }
  }, [isPrefsDirty]);

  const currentPrefixesDraft =
    isPrefsDirty && namePrefixesDraft !== null
      ? namePrefixesDraft
      : (prefs.namePrefixesToIgnore ?? []).join(", ");

  const toggleDetectionField = (fieldId: string, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...detectionFields, fieldId]))
      : detectionFields.filter((field) => field !== fieldId);
    onUpdatePreference("duplicateDetectionFields", next.length > 0 ? next : ["name"]);
  };

  return (
    <SectionCard
      title={t("contacts.setup.duplicateDetection")}
      icon={Copy}
      headingLevel={2}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t("contacts.setup.duplicateDetectionDesc")}
        </p>
        <fieldset className="space-y-2">
          <legend className={FORM_LABEL}>{t("contacts.setup.duplicateFields")}</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DUPLICATE_DETECTION_FIELD_IDS.map((option) => {
              const checked = detectionFields.includes(option);
              const checkboxId = `dup-field-${option}`;
              return (
                <FormCheckboxCard
                  key={option}
                  id={checkboxId}
                  name={checkboxId}
                  checked={checked}
                  onCheckedChange={(value) => toggleDetectionField(option, value)}
                  label={getDuplicateFieldLabel(option, t)}
                />
              );
            })}
          </div>
        </fieldset>

        <Field
          id="namePrefixesToIgnore"
          label={t("contacts.setup.namePrefixesToIgnore")}
          hint={t("contacts.setup.namePrefixesToIgnoreDesc")}
        >
          <Input
            id="namePrefixesToIgnore"
            name="namePrefixesToIgnore"
            className={FORM_INPUT}
            value={currentPrefixesDraft}
            onChange={(e) => {
              const raw = e.target.value;
              setNamePrefixesDraft(raw);
              const next = raw
                .split(",")
                .map((prefix) => prefix.trim())
                .filter(Boolean);
              onUpdatePreference("namePrefixesToIgnore", next);
            }}
            placeholder={t("contacts.setup.namePrefixesToIgnorePlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="dupThresholdHigh" label={t("contacts.setup.duplicateThresholdHigh")}>
            <Input
              id="dupThresholdHigh"
              name="duplicateDetectionThresholdHigh"
              type="text"
              inputMode="numeric"
              min={1}
              max={100}
              className={FORM_INPUT}
              value={prefs.duplicateDetectionThresholdHigh ?? 90}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onUpdatePreference(
                  "duplicateDetectionThresholdHigh",
                  Number.isFinite(parsed) ? parsed : (prefs.duplicateDetectionThresholdHigh ?? 90),
                );
              }}
            />
          </Field>
          <Field id="dupThresholdMedium" label={t("contacts.setup.duplicateThresholdMedium")}>
            <Input
              id="dupThresholdMedium"
              name="duplicateDetectionThresholdMedium"
              type="text"
              inputMode="numeric"
              min={1}
              max={100}
              className={FORM_INPUT}
              value={prefs.duplicateDetectionThresholdMedium ?? 75}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onUpdatePreference(
                  "duplicateDetectionThresholdMedium",
                  Number.isFinite(parsed)
                    ? parsed
                    : (prefs.duplicateDetectionThresholdMedium ?? 75),
                );
              }}
            />
          </Field>
        </div>
      </div>

      {onSave ? (
        <ModuleSetupSaveFooter
          dirty={Boolean(isPrefsDirty)}
          saving={Boolean(saving)}
          saved={Boolean(saved)}
          saveLabel={saving ? t("global.saving") : t("contacts.setup.saveAndApply")}
          savedLabel={t("contacts.form.saved")}
          onSave={onSave}
          disableUnsavedGuard
          footerClassName="mt-4 pt-3"
        />
      ) : null}
    </SectionCard>
  );
}
