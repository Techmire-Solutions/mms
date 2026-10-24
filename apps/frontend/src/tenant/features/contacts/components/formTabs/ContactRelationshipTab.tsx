import React, { useCallback, useMemo } from "react";
import { Heart } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { getDisplayName, getPrimaryPhone } from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import {
  FieldErrorMessage,
  FormCardTypeSelect,
  FormSelect,
  TYPE_SELECT_WIDTH,
  type FormSelectOption,
} from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactOptionLabel } from "@/lib/contacts/contactI18n";
import { FormListFieldCard } from "@/components/app/FormPrimitives";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import type { ContactSubListTabBaseProps } from "./types";

/** Fixed 6 static system relationship options aligned 1:1 with relationship inference engine. */
export const STATIC_RELATIONSHIP_OPTIONS: readonly string[] = [
  "Parent",
  "Child",
  "Husband",
  "Wife",
  "Guardian",
  "Dependent",
] as const;

export interface ContactRelationshipTabProps extends ContactSubListTabBaseProps {
  /** @deprecated Relationship options are hardcoded to the 6 system types. */
  relationshipOptions?: string[];
  /** @deprecated Relationship types cannot be dynamically added or modified. */
  onUpdateRelationships?: (options: string[]) => void;
}

export function ContactRelationshipTab({
  contactDraft,
  formInstanceId,
  getLocalId,
  isFieldEnabled,
  isFieldRequired,
  getListItemError,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
}: ContactRelationshipTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const relationshipContacts = contactDraft.relationshipContacts;
  const links = useMemo(() => relationshipContacts ?? [], [relationshipContacts]);
  const showLinkedContact = isFieldEnabled("relationship", "contactId");
  const showRelationshipType = isFieldEnabled("relationship", "relationship");
  const allowAdd = resolveSubListAllowAdd([showLinkedContact, showRelationshipType]);
  const contactIdRequired = isFieldRequired("relationship", "contactId");

  const baseOptions: FormSelectOption[] = useMemo(
    () =>
      STATIC_RELATIONSHIP_OPTIONS.map((opt) => ({
        value: opt,
        label: formatContactOptionLabel(opt, t) || opt,
      })),
    [t],
  );

  const emptyLink = useCallback(
    () => ({
      relationship: STATIC_RELATIONSHIP_OPTIONS[0],
      contactId: "",
    }),
    [],
  );

  const excludeIds = useCallback(
    (idx: number): (string | number)[] => {
      const linked = links
        .filter((_, i) => i !== idx)
        .map((link) => link.contactId)
        .filter((cid) => cid != null && String(cid).length > 0) as (string | number)[];
      if (contactDraft.id != null) linked.unshift(contactDraft.id);
      return linked;
    },
    [links, contactDraft.id],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("contacts.form.relationshipInstructions")}</p>
      <ContactSubListShell
        isEmpty={links.length === 0}
        emptyIcon={Heart}
        emptyMessage={t("contacts.form.noRelationshipsSet")}
        addLabel={t("contacts.form.addRelationshipLink")}
        onAdd={() => addSubListItem("relationshipContacts", emptyLink())}
        onEnsureRow={() => ensureSubListItem("relationshipContacts", emptyLink())}
        allowAdd={allowAdd}
      >
        <AnimatePresence initial={false}>
          {links.map((link, idx) => {
            const pickerError = getListItemError("relationship", "contactId", idx);
            const currentVal = link.relationship;
            const typeValue = currentVal || STATIC_RELATIONSHIP_OPTIONS[0];
            const isKnown = (STATIC_RELATIONSHIP_OPTIONS as readonly string[]).includes(
              currentVal || "",
            );
            const selectOptions: FormSelectOption[] =
              isKnown || !currentVal
                ? baseOptions
                : [{ value: currentVal, label: currentVal }, ...baseOptions];

            return (
              <FormListFieldCard
                key={getLocalId("relationship", idx)}
                id={getLocalId("relationship", idx)}
                index={idx}
                icon={Heart}
                label={undefined}
                typeSelect={
                  showRelationshipType ? (
                    <FormCardTypeSelect label={t("contacts.form.relationshipType")}>
                      <FormSelect
                        options={selectOptions}
                        value={typeValue}
                        onChange={(val) =>
                          updateSubListItem("relationshipContacts", idx, { relationship: val })
                        }
                        className={TYPE_SELECT_WIDTH}
                        id={`cf-${formInstanceId}-relationship-type-${idx}`}
                        name={`cf-${formInstanceId}-relationship-type-${idx}`}
                        aria-label={t("contacts.form.relationshipType")}
                      />
                    </FormCardTypeSelect>
                  ) : undefined
                }
                onRemove={() => removeSubListItem("relationshipContacts", idx)}
                removeLabel={t("contacts.form.removeRelationship", { index: idx + 1 })}
              >
                <div className="space-y-3">
                  {showLinkedContact ? (
                    <div>
                      <ContactPicker
                        label={t("contacts.form.linkContact")}
                        required={contactIdRequired}
                        value={link.contactId ?? null}
                        onChange={(id, selectedContact) => {
                          updateSubListItem("relationshipContacts", idx, {
                            contactId: id != null ? String(id) : "",
                            name: selectedContact ? getDisplayName(selectedContact) : undefined,
                            phone: selectedContact
                              ? getPrimaryPhone(selectedContact) || undefined
                              : undefined,
                          });
                        }}
                        excludeIds={excludeIds(idx)}
                        searchPlaceholder={t("contacts.form.searchByName")}
                        emptyTitle={t("contacts.form.noContactsFound")}
                        id={`cf-${formInstanceId}-relationship-contact-${idx}`}
                        name={`cf-${formInstanceId}-relationship-contact-${idx}`}
                        error={Boolean(pickerError)}
                      />
                      <FieldErrorMessage message={pickerError} />
                    </div>
                  ) : null}
                </div>
              </FormListFieldCard>
            );
          })}
        </AnimatePresence>
      </ContactSubListShell>
    </div>
  );
}
