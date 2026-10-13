import React from "react";
import type { ChangeEvent } from "react";
import { SectionCard } from "@/components/app/SectionCard";
import type { Contact } from "@mms/shared";
import { ContactBasicAvatarSection } from "@/tenant/features/contacts/components/formTabs/ContactBasicAvatarSection";
import { ContactBasicIdentityFields } from "@/tenant/features/contacts/components/formTabs/ContactBasicIdentityFields";

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
  handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
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
  handleAvatarChange,
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
      </div>
    </SectionCard>
  );
}
