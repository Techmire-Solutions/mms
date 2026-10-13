import React from "react";
import { AlertTriangle } from "lucide-react";
import { WarningCallout } from "@/components/app/WarningCallout";
import { useTranslation } from "@/hooks/useTranslation";
import { ContactBasicTab } from "@/tenant/features/contacts/components/formTabs/ContactBasicTab";
import { ContactFormNestedTabsDispatcher } from "@/tenant/features/contacts/components/ContactFormNestedTabsDispatcher";
import type { ContactSubListTabBaseProps } from "@/tenant/features/contacts/components/formTabs/types";
import type { useContactFormDraft } from "@/tenant/features/contacts/hooks/useContactFormDraft";
import { normalizeContactFormTabId, type FieldDefinition } from "@mms/shared";

export type ContactFormDraftState = ReturnType<typeof useContactFormDraft>;

export interface ContactFormTabContentProps {
  tab: string;
  draft: ContactFormDraftState;
  lockGender: boolean;
  defaultCountry: string;
  defaultCity: string;
  defaultProvince: string;
}

const EMPTY_FIELDS: Record<string, FieldDefinition[]> = {};

function subListBaseProps(draft: ContactFormDraftState): ContactSubListTabBaseProps {
  return {
    contactDraft: draft.contactDraft,
    getLocalId: draft.getLocalId,
    getListItemError: draft.getListItemError,
    isFieldEnabled: draft.isFieldEnabled,
    isFieldRequired: draft.isFieldRequired,
    fields: draft.fields ?? EMPTY_FIELDS,
    formInstanceId: draft.formInstanceId,
    addSubListItem: draft.addSubListItem,
    ensureSubListItem: draft.ensureSubListItem,
    updateSubListItem: draft.updateSubListItem,
    removeSubListItem: draft.removeSubListItem,
    setPrimarySubListItem: draft.setPrimarySubListItem,
  };
}

/**
 * Dispatches active ContactForm tab view rendering (Basic info vs nested collection lists vs custom tabs).
 */
export function ContactFormTabContent({
  tab,
  draft,
  lockGender,
  defaultCountry,
  defaultCity,
  defaultProvince,
}: ContactFormTabContentProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const normalizedTab = normalizeContactFormTabId(tab);

  if (draft.lookupsLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const listBase = subListBaseProps(draft);

  const renderTabBody = () => {
    if (normalizedTab === "basic") {
      return (
        <ContactBasicTab
          contactDraft={draft.contactDraft}
          formInstanceId={draft.formInstanceId}
          isFieldEnabled={draft.isFieldEnabled}
          isFieldRequired={draft.isFieldRequired}
          getFieldError={draft.getFieldError}
          updateDraft={draft.updateDraft}
          cropSrc={draft.cropSrc}
          setCropSrc={draft.setCropSrc}
          genders={draft.genders}
          onUpdateGenders={draft.updateGenders}
          tags={draft.tags}
          onUpdateTags={draft.updateTags}
          lockGender={lockGender}
          handleAvatarChange={draft.handleAvatarChange}
        />
      );
    }

    return (
      <ContactFormNestedTabsDispatcher
        normalizedTab={normalizedTab}
        draft={draft}
        listBase={listBase}
        defaultCountry={defaultCountry}
        defaultCity={defaultCity}
        defaultProvince={defaultProvince}
      />
    );
  };

  const body = renderTabBody();
  if (!body) return null;

  return (
    <div className="space-y-3">
      {draft.duplicateCount > 0 && (
        <div role="status" aria-live="polite">
          <WarningCallout
            tone="warning"
            density="compact"
            icon={AlertTriangle}
            title={t("contacts.duplicates.title")}
            description={t("contacts.duplicates.potentialDuplicatesAlert", {
              count: draft.duplicateCount,
            })}
          />
        </div>
      )}
      {body}
    </div>
  );
}
