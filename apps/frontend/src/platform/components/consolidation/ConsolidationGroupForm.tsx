import type React from "react";
import { useState } from "react";
import { Layers } from "lucide-react";
import { ISO_4217_CURRENCIES, type AppTranslationKey, type ConsolidationGroup } from "@mms/shared";
import { Input } from "@shared/ui";
import { EditableMultiSelect } from "@/components/app/EditableMultiSelect";
import { FormCollectionShell } from "@/components/app/FormCollectionShell";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useConsolidationGroupDraft } from "@/platform/hooks/useConsolidationGroupDraft";
import { useSaveConsolidationGroup } from "@/platform/hooks/usePlatformConsolidation";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import { ConsolidationMemberRow } from "./ConsolidationMemberRow";

interface ConsolidationGroupFormProps {
  initial: ConsolidationGroup | null;
  onClose: () => void;
}

const CURRENCY_OPTIONS = ISO_4217_CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} – ${currency.name}`,
}));

/** Create or edit a consolidation group (members, ownership, rates, intercompany accounts). */
export function ConsolidationGroupForm({
  initial,
  onClose,
}: ConsolidationGroupFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const form = useConsolidationGroupDraft(initial);
  const save = useSaveConsolidationGroup();
  const { data: workspaces = [] } = usePlatformWorkspaces({ limit: 100 });
  const [error, setError] = useState<string | undefined>();
  const workspaceOptions = workspaces.map((workspace) => ({
    value: workspace.subdomain,
    label: workspace.madrasaName
      ? `${workspace.madrasaName} (${workspace.subdomain})`
      : workspace.subdomain,
  }));

  const handleSave = async (): Promise<void> => {
    const parsed = form.parse();
    if (!parsed.ok) {
      setError(
        t(
          (parsed.message.startsWith("consolidation.")
            ? parsed.message
            : "common.formPleaseFixErrors") as AppTranslationKey,
        ),
      );
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync({ id: form.draft.id, body: parsed.body });
      notify.success(t("platform.consolidation.saved"));
      onClose();
    } catch (saveError) {
      notify.error(t("platform.consolidation.saveFailed"), {
        description: saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={initial ? t("platform.consolidation.editGroup") : t("platform.consolidation.newGroup")}
      icon={Layers}
      size="xl"
      tall
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={save.isPending}
      error={error}
    >
      <div className="space-y-3 text-start">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="cons-name" label={t("platform.consolidation.groupName")} required>
            <Input
              id="cons-name"
              name="name"
              value={form.draft.name}
              onChange={(event) => form.setDraft((d) => ({ ...d, name: event.target.value }))}
            />
          </Field>
          <Field id="cons-currency" label={t("platform.consolidation.presentationCurrency")}>
            <FormSelect
              id="cons-currency"
              name="presentationCurrency"
              value={form.draft.presentationCurrency}
              onChange={(value) => form.setDraft((d) => ({ ...d, presentationCurrency: value }))}
              options={CURRENCY_OPTIONS}
              searchable
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="cons-intercompany"
              label={t("platform.consolidation.intercompanyCodes")}
              hint={t("platform.consolidation.intercompanyHint")}
            >
              <EditableMultiSelect
                id="cons-intercompany"
                name="intercompanyAccountCodes"
                options={form.draft.intercompanyAccountCodes}
                values={form.draft.intercompanyAccountCodes}
                onChange={(values) =>
                  form.setDraft((d) => ({ ...d, intercompanyAccountCodes: values }))
                }
                onUpdateOptions={(values) =>
                  form.setDraft((d) => ({ ...d, intercompanyAccountCodes: values }))
                }
                addPlaceholder={t("platform.consolidation.addAccountCode")}
              />
            </Field>
          </div>
        </div>
        <FormCollectionShell
          title={t("platform.consolidation.members")}
          addLabel={t("platform.consolidation.addMember")}
          onAdd={form.addMember}
        >
          {form.draft.members.map((member, index) => (
            <ConsolidationMemberRow
              key={member.key}
              member={member}
              index={index}
              workspaceOptions={workspaceOptions}
              canRemove={form.draft.members.length > 1}
              onChange={(patch) => form.updateMember(member.key, patch)}
              onRemove={() => form.removeMember(member.key)}
            />
          ))}
        </FormCollectionShell>
      </div>
    </FormModal>
  );
}
