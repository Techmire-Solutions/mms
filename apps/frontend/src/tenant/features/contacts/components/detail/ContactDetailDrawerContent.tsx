import React from "react";
import type { ChangeEvent, RefObject } from "react";
import { m, AnimatePresence } from "framer-motion";
import type { Contact } from "@mms/shared";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ContactDetailOverview } from "@/tenant/features/contacts/components/detail/ContactDetailOverview";
import { ContactDetailTimeline } from "@/tenant/features/contacts/components/detail/ContactDetailTimeline";
import { ContactDetailFiles } from "@/tenant/features/contacts/components/detail/ContactDetailFiles";
import type { DetailFieldView } from "@/tenant/features/contacts/hooks/useContactDetailViewModel";

export interface ContactDetailDrawerContentProps {
  activeTab: string;
  contactState: Contact;
  allContacts: Contact[];
  grouped: Record<string, DetailFieldView[]>;
  formatFieldValue: (field: { key: string; type: string }) => string | null;
  visibleCollectionFields: {
    phones: { enabled?: boolean }[];
    emails: { enabled?: boolean }[];
    addresses: { enabled?: boolean }[];
    socials: { enabled?: boolean }[];
    education: { enabled?: boolean }[];
    experience: { enabled?: boolean }[];
    skills: { enabled?: boolean }[];
    bankDetails?: { enabled?: boolean }[];
    relationship: { enabled?: boolean }[];
  };
  primaryPhone: string | null;
  primaryEmail: string | null;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  onNavigateToContact: (targetId: string | number) => void;
  activities: Contact["activities"];
  canPersistContact: boolean;
  onAddNote: (content: string) => Promise<boolean | void>;
  isDragging: boolean;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onDraggingChange: (next: boolean) => void;
  onFiles: (filesList: FileList | null) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRequestDelete: (attachment: { id: string; name: string }) => void;
}

export function ContactDetailDrawerContent({
  activeTab,
  contactState,
  allContacts,
  grouped,
  formatFieldValue,
  visibleCollectionFields,
  primaryPhone,
  primaryEmail,
  onWhatsApp,
  onSms,
  onEmail,
  onNavigateToContact,
  activities,
  canPersistContact,
  onAddNote,
  isDragging,
  isUploading,
  fileInputRef,
  onDraggingChange,
  onFiles,
  onFileChange,
  onRequestDelete,
}: ContactDetailDrawerContentProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={activeTab}
        role="tabpanel"
        id={`contact-detail-drawer-${activeTab}`}
        aria-labelledby={`contact-detail-drawer-tab-${activeTab}`}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: reducedMotion ? 0 : 0.15 }}
        className="space-y-6"
      >
        {activeTab === "overview" && (
          <ContactDetailOverview
            contact={contactState}
            allContacts={allContacts}
            grouped={grouped}
            formatFieldValue={formatFieldValue}
            visibleCollectionFields={visibleCollectionFields}
            primaryPhone={primaryPhone}
            primaryEmail={primaryEmail}
            onWhatsApp={onWhatsApp}
            onSms={onSms}
            onEmail={onEmail}
            onNavigateToContact={onNavigateToContact}
          />
        )}

        {activeTab === "timeline" && (
          <ContactDetailTimeline
            activities={activities || []}
            canPersistContact={canPersistContact}
            onAddNote={onAddNote}
          />
        )}

        {activeTab === "files" && (
          <ContactDetailFiles
            contact={contactState}
            canPersistContact={canPersistContact}
            isDragging={isDragging}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            onDraggingChange={onDraggingChange}
            onFiles={onFiles}
            onFileChange={onFileChange}
            onRequestDelete={onRequestDelete}
          />
        )}
      </m.div>
    </AnimatePresence>
  );
}
