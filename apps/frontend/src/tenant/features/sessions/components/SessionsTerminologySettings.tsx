import React, { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import {
  ACADEMIC_TERM_KEYS,
  ACADEMIC_TERM_LANGUAGES,
  ACADEMIC_TERM_MAX_LENGTH,
  APP_LANGUAGES,
  type AcademicTermKey,
  type AcademicTerminology,
} from "@mms/shared";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/FormPrimitives";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsSetupPanelState } from "@/tenant/features/sessions/hooks/useSessionsSetupPanelState";

type Language = (typeof ACADEMIC_TERM_LANGUAGES)[number];
type Field = "singular" | "plural";

const LANGUAGE_BY_CODE = new Map(APP_LANGUAGES.map((option) => [option.code, option]));
const languageLabel = (code: Language) => LANGUAGE_BY_CODE.get(code)?.nativeLabel ?? code;
const languageDir = (code: Language) => LANGUAGE_BY_CODE.get(code)?.direction ?? "ltr";

export interface SessionsTerminologySettingsProps {
  /** Reports draft dirtiness to the Setup shell (leave-guard). */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Sessions → Setup → Terminology: per-language relabels for Session / Class / Section. */
export function SessionsTerminologySettings({ onDirtyChange }: SessionsTerminologySettingsProps): React.JSX.Element {
  const { t, language: uiLanguage } = useTranslation();
  const { settingsDraft, upd, saved, saving, isPrefsDirty, handleSave } = useSessionsSetupPanelState();
  const [language, setLanguage] = useState<Language>(
    (ACADEMIC_TERM_LANGUAGES as readonly string[]).includes(uiLanguage) ? (uiLanguage as Language) : "en",
  );
  const terminology: AcademicTerminology = settingsDraft.terminology ?? {};

  useEffect(() => {
    onDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onDirtyChange]);

  const setTerm = (key: AcademicTermKey, field: Field, value: string) => {
    const current = terminology[language]?.[key] ?? { singular: "", plural: "" };
    upd("terminology", { ...terminology, [language]: { ...terminology[language], [key]: { ...current, [field]: value } } });
  };

  return (
    <ModuleSetupContent>
      <SectionCard title={t("academicTerms.title")} icon={Languages} accentColor="primary" className={SETUP_SECTION_CARD_CLASS}>
        <p className="mb-3 text-sm text-muted-foreground text-pretty">{t("academicTerms.hint")}</p>
        <SubTabBar
          tabs={ACADEMIC_TERM_LANGUAGES.map((code) => ({ key: code, label: languageLabel(code) }))}
          value={language}
          onChange={(next) => setLanguage(next as Language)}
        />
        <div className="mt-4 space-y-4">
          {ACADEMIC_TERM_KEYS.map((key) => (
            <fieldset key={key} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              <legend className="text-sm font-medium sm:pb-3">{t(`academicTerms.${key}.singular`)}</legend>
              {(["singular", "plural"] as const).map((field) => (
                <Field key={field} id={`term-${language}-${key}-${field}`} label={t(`academicTerms.${field}`)}>
                  <Input
                    id={`term-${language}-${key}-${field}`}
                    dir={languageDir(language)}
                    lang={language}
                    value={terminology[language]?.[key]?.[field] ?? ""}
                    placeholder={t(`academicTerms.${key}.${field}`)}
                    maxLength={ACADEMIC_TERM_MAX_LENGTH}
                    onChange={(event) => setTerm(key, field, event.target.value)}
                    className="min-h-11"
                  />
                </Field>
              ))}
            </fieldset>
          ))}
        </div>
      </SectionCard>
      <ModuleSetupSaveFooter
        dirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={isPrefsDirty ? t("sessions.setup.unsavedPreferencesWarning") : undefined}
        saveLabel={saving ? t("global.saving") : t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={handleSave}
      />
    </ModuleSetupContent>
  );
}

export default SessionsTerminologySettings;
