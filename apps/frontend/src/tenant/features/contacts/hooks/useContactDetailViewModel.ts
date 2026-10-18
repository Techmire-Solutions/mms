import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { type Contact, getPrimaryPhone, getPrimaryEmail } from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ICON_MAP,
  DEFAULT_DETAIL_TAB_BY_KEY,
} from "@/tenant/features/contacts/components/detail/contactDetailStyles";
import { useContactDetailActions } from "@/tenant/features/contacts/hooks/useContactDetailActions";
import { useContactDetailFields } from "@/tenant/features/contacts/hooks/useContactDetailFields";
import { useContactById } from "@/tenant/hooks/collections/contacts";

export type { DetailFieldView } from "@/tenant/features/contacts/hooks/useContactDetailFields";

export function useContactDetailViewModel({
  initialContact,
  allContacts,
  onUpdateContact,
  canWrite,
  onNavigateToContact,
}: {
  initialContact: Contact;
  allContacts: Contact[];
  onUpdateContact?: (contact: Contact) => Promise<void>;
  canWrite: boolean;
  onNavigateToContact?: (targetId: string | number) => void;
}) {
  const { enabledTabIds, isTabFieldEnabled, fields } = useContactConfig();
  const { role } = usePermissions();
  // role is string|undefined from usePermissions; "" maps to no-permission baseline in canViewContactField.
  const viewerRole = role ?? "";
  const { t } = useTranslation();
  const [contactState, setContactState] = useState<Contact>(initialContact);
  const activeContactId = contactState?.id != null ? String(contactState.id) : undefined;
  const { data: fullContact } = useContactById(activeContactId);
  const isArchived = Boolean(contactState.deletedAt ?? initialContact.deletedAt);
  const canPersistContact = canWrite && Boolean(onUpdateContact) && !isArchived;

  // DEFAULT_DETAIL_TABS is a static constant — tabs are not driven by enabledTabIds.
  // If that changes, add enabledTabIds to deps and audit callers.
  const detailTabs = useMemo(() => {
    return Array.from(DEFAULT_DETAIL_TAB_BY_KEY.values()).map((tab) => ({
      key: tab.key,
      label: tab.labelKey ? t(tab.labelKey) : tab.label,
      icon: ICON_MAP[tab.icon || tab.key] || LayoutDashboard,
    }));
  }, [t]);

  const [activeTab, setActiveTab] = useState<string>(() => detailTabs[0]?.key || "");

  useEffect(() => {
    setContactState(initialContact);
  }, [initialContact]);

  useEffect(() => {
    if (fullContact && String(fullContact.id) === String(contactState.id)) {
      setContactState(fullContact);
    }
  }, [fullContact, contactState.id]);

  useEffect(() => {
    setActiveTab((currentTab) => {
      const tabExists = detailTabs.some((tab) => tab.key === currentTab);
      if (!currentTab || !tabExists) {
        return detailTabs[0]?.key || "";
      }
      return currentTab;
    });
  }, [initialContact.id, detailTabs]);

  const combinedActivities = useMemo(() => {
    const noteActs = contactState.activities || [];
    return [...noteActs].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );
  }, [contactState.activities]);

  const { grouped, formatFieldValue, visibleCollectionFields } = useContactDetailFields({
    fields,
    viewerRole,
    contactState,
    isTabFieldEnabled,
    t,
  });

  const primaryPhone = enabledTabIds.has("phones") ? getPrimaryPhone(contactState) : null;
  const primaryEmail = enabledTabIds.has("emails") ? getPrimaryEmail(contactState) : null;

  const { handleAddNote, handleNavigateToContact } = useContactDetailActions({
    allContacts,
    contactState,
    setContactState,
    canPersistContact,
    onUpdateContact,
    onNavigateToContact,
  });

  return {
    contactState,
    setContactState,
    canPersistContact,
    detailTabs,
    activeTab,
    setActiveTab,
    grouped,
    formatFieldValue,
    visibleCollectionFields,
    combinedActivities,
    primaryPhone,
    primaryEmail,
    handleAddNote,
    handleNavigateToContact,
  };
}
