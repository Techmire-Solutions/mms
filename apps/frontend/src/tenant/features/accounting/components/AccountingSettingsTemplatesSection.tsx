import { Sparkles, Tags } from "lucide-react";
import {
  buildSeedJournalTemplates,
  generateClientEntityId,
  type Account,
  type AccountingSettings,
  type JournalTemplate,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormPrimitives";
import { FormCollectionShell } from "@/components/app/FormCollectionShell";
import { FormListFieldCard } from "@/components/app/FormListFieldCard";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

export interface AccountingSettingsTemplatesSectionProps {
  accounts: Account[];
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

function hasInvalidNames(templates: readonly JournalTemplate[]): boolean {
  const names = templates.map((template) => template.name.trim().toLowerCase());
  return names.some((name) => !name) || new Set(names).size !== names.length;
}

/** Setup → Preferences: editable journal templates (tags with default debit/credit heads). */
export function AccountingSettingsTemplatesSection({
  accounts,
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AccountingSettingsTemplatesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const templates = settingsDraft.journalTemplates ?? [];
  const accountOptions = accounts
    .filter((account) => account.isActive !== false)
    .toSorted((first, second) => first.code.localeCompare(second.code))
    .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }));

  const setTemplates = (next: JournalTemplate[]) => upd("journalTemplates", next);
  const patch = (index: number, change: Partial<JournalTemplate>) =>
    setTemplates(
      templates.map((template, current) =>
        current === index ? { ...template, ...change } : template,
      ),
    );

  return (
    <SectionCard
      title={t("accounting.templates.title")}
      icon={Tags}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        {t("accounting.templates.description")}
      </p>
      {templates.length === 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setTemplates(buildSeedJournalTemplates(accounts, t))}
          className="mb-3 min-h-11 gap-2"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" /> {t("accounting.templates.seedAction")}
        </Button>
      )}
      <FormCollectionShell
        isEmpty={templates.length === 0}
        emptyMessage={t("accounting.templates.empty")}
        addLabel={t("accounting.templates.add")}
        onAdd={() =>
          setTemplates([
            ...templates,
            {
              id: generateClientEntityId("tpl", "-"),
              name: "",
              debitAccountId: "",
              creditAccountId: "",
            },
          ])
        }
        listKey="accounting-journal-templates"
      >
        {templates.map((template, index) => (
          <FormListFieldCard
            key={template.id}
            id={template.id}
            index={index}
            icon={Tags}
            label={template.name || t("accounting.templates.name")}
            onRemove={() => setTemplates(templates.filter((_, current) => current !== index))}
            removeLabel={t("accounting.templates.remove", { name: template.name })}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field id={`template-${template.id}-name`} label={t("accounting.templates.name")}>
                <Input
                  id={`template-${template.id}-name`}
                  value={template.name}
                  maxLength={60}
                  onChange={(event) => patch(index, { name: event.target.value })}
                />
              </Field>
              <Field
                id={`template-${template.id}-debit`}
                label={t("accounting.templates.debitHead")}
              >
                <FormSelect
                  id={`template-${template.id}-debit`}
                  value={template.debitAccountId}
                  onChange={(accountId) => patch(index, { debitAccountId: accountId })}
                  placeholder={t("accounting.templates.noHead")}
                  options={accountOptions}
                />
              </Field>
              <Field
                id={`template-${template.id}-credit`}
                label={t("accounting.templates.creditHead")}
              >
                <FormSelect
                  id={`template-${template.id}-credit`}
                  value={template.creditAccountId}
                  onChange={(accountId) => patch(index, { creditAccountId: accountId })}
                  placeholder={t("accounting.templates.noHead")}
                  options={accountOptions}
                />
              </Field>
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
      {hasInvalidNames(templates) && (
        <Alert density="compact" description={t("accounting.templates.duplicateName")} />
      )}
      <ModuleSetupSaveFooter
        dirty={Boolean(isPrefsDirty) && !hasInvalidNames(templates)}
        saving={Boolean(saving)}
        saved={Boolean(saved)}
        saveLabel={saving ? t("global.saving") : t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={onSave ?? (() => {})}
        disableUnsavedGuard
        footerClassName="mt-4 pt-3"
      />
    </SectionCard>
  );
}
