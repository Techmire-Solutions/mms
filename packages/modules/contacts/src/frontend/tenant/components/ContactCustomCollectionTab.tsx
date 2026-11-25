import type React from "react";
import { FormCollectionShell, FormListFieldCard } from "@mms/fe-core/components/FormPrimitives";
import { RegistryCustomFieldsGrid } from "@mms/fe-core/components/RegistryCustomFieldsGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { useStableRowList } from "@mms/fe-core/forms/useStableRowList";
import type { useContactFormDraft } from "../hooks/useContactFormDraft";

type ContactFormDraftState = ReturnType<typeof useContactFormDraft>;

interface ContactCustomCollectionTabProps {
  tabId: string;
  draft: ContactFormDraftState;
}

/**
 * Tenant-created contact tab: a repeatable collection whose row fields come
 * straight from the tab's registry field list. Values live on the draft as
 * `contactDraft[tabId]` (the same property the dynamic schema validates).
 */
export function ContactCustomCollectionTab({
  tabId,
  draft,
}: ContactCustomCollectionTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const fields = (draft.fields[tabId] ?? []).filter((field) => field.enabled !== false);
  const currentRows = (draft.contactDraft as Record<string, unknown>)[tabId];
  const values: Record<string, unknown>[] = Array.isArray(currentRows)
    ? (currentRows as Record<string, unknown>[])
    : [];

  const { rows, append, removeAt, updateAt } = useStableRowList<Record<string, unknown>>({
    values,
    onChange: (next) => draft.updateDraft({ [tabId]: next }),
    createValue: () => ({}),
    serialize: (next) => JSON.stringify(next),
  });

  const errorsForRow = (index: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const message = draft.getListItemError(tabId, field.key, index);
      if (message) errors[field.key] = message;
    }
    return errors;
  };

  return (
    <FormCollectionShell
      addLabel={t("common.add")}
      onAdd={append}
      listKey={`contact-custom-${tabId}`}
    >
      {rows.map((row, index) => (
        <FormListFieldCard
          key={row.id}
          id={`contact-custom-${row.id}`}
          index={index}
          label={t("contacts.form.customCollectionRow", { n: index + 1 })}
          removeLabel={t("common.delete")}
          canRemove
          onRemove={() => removeAt(index)}
        >
          <RegistryCustomFieldsGrid
            fields={fields}
            values={row.value}
            errors={errorsForRow(index)}
            idPrefix={`contact-${tabId}-${row.id}`}
            onChange={(key, value) => updateAt(index, (current) => ({ ...current, [key]: value }))}
          />
        </FormListFieldCard>
      ))}
    </FormCollectionShell>
  );
}
