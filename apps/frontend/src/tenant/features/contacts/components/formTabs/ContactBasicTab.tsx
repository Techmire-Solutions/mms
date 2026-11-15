import React from "react";
import type { ChangeEvent } from "react";
import { SectionCard } from "@/components/app/SectionCard";
import {
  listEnabledCustomContactFormFields,
  type Contact,
  type FieldDefinition,
} from "@mms/shared";
import { ContactBasicAvatarSection } from "@/tenant/features/contacts/components/formTabs/ContactBasicAvatarSection";
import { ContactBasicIdentityFields } from "@/tenant/features/contacts/components/formTabs/ContactBasicIdentityFields";
import { RegistryCustomFieldsGrid } from "@/components/app/RegistryCustomFieldsGrid";

export interface ContactBasicTabProps {
  contactDraft: Partial<Contact>;
  formInstanceId: string;
  isFieldEnabled: (tabId: string, fieldId: string) => boolean;
  isFieldRequired: (tabId: string, fieldId: string) => boolean;
  getFieldError: (fieldId: string) => string | undefined;
  updateDraft: (patch: Partial<Contact>) => void;
  cropSrc: string | null;
  setCropSrc: (src: string | null) => void;
  genders: string[];
  onUpdateGenders: (genders: string[]) => void;
  tags?: string[];
  onUpdateTags?: (tags: string[]) => void;
  lockGender: boolean;
  /** Tenant field registry; its `basic` custom fields render below the identity block. */
  fields?: Record<string, FieldDefinition[]>;
  handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAvatarFileSelect?: (file: File) => void;
}

/** Basic Info form tab: avatar upload/crop and core personal identity fields. */
export function ContactBasicTab({
  contactDraft,
  formInstanceId,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  updateDraft,
  cropSrc,
  setCropSrc,
  genders,
  onUpdateGenders,
  tags,
  onUpdateTags,
  lockGender,
  fields,
  handleAvatarChange,
  onAvatarFileSelect,
}: ContactBasicTabProps): React.JSX.Element {
  return (
    <SectionCard accentColor="primary" className="text-start">
      <div className="space-y-5">
        {isFieldEnabled("basic", "avatar") && (
          <ContactBasicAvatarSection
            contactDraft={contactDraft}
            formInstanceId={formInstanceId}
            cropSrc={cropSrc}
            setCropSrc={setCropSrc}
            updateDraft={updateDraft}
            handleAvatarChange={handleAvatarChange}
            onAvatarFileSelect={onAvatarFileSelect}
          />
        )}

        <ContactBasicIdentityFields
          contactDraft={contactDraft}
          formInstanceId={formInstanceId}
          isFieldEnabled={isFieldEnabled}
          isFieldRequired={isFieldRequired}
          getFieldError={getFieldError}
          updateDraft={updateDraft}
          genders={genders}
          onUpdateGenders={onUpdateGenders}
          tags={tags}
          onUpdateTags={onUpdateTags}
          lockGender={lockGender}
        />

        {(() => {
          const customFields = listEnabledCustomContactFormFields(fields ?? {}, "basic");
          if (customFields.length === 0) return null;
          const customErrors: Record<string, string> = {};
          for (const field of customFields) {
            const message = getFieldError(field.key);
            if (message) customErrors[field.key] = message;
          }
          return (
            <RegistryCustomFieldsGrid
              fields={customFields}
              values={contactDraft as Record<string, unknown>}
              errors={customErrors}
              idPrefix="contact-custom-field"
              onChange={(key, value) => updateDraft({ [key]: value } as Partial<Contact>)}
            />
          );
        })()}
      </div>
    </SectionCard>
  );
}
