/**
 * @file ContactDetailDrawerChrome.tsx
 * @description Header actions, banner, tab-bar, and footer chrome partitions for ContactDetailDrawer.
 */
import React from "react";
import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SubTabBar, type SubTab } from "@/components/app/SubTabBar";
import { DetailDrawerRestoreOrEditAction } from "@/components/app/DetailDrawerArchiveChrome";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import { ContactArchivedBanner } from "@/tenant/features/contacts/components/ContactArchivedBanner";

export interface ContactDetailDrawerHeaderActionsProps {
  canWrite: boolean;
  canDelete: boolean;
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onRestore?: (contactId: string | number) => void | Promise<void>;
}

export function ContactDetailDrawerHeaderActions({
  canWrite,
  canDelete,
  contact,
  onEdit,
  onRestore,
}: ContactDetailDrawerHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const isArchived = Boolean(contact.deletedAt);

  return (
    <DetailDrawerRestoreOrEditAction
      isArchived={isArchived}
      canRestore={canDelete}
      canEdit={canWrite}
      restoreLabel={t("contacts.restoreContact")}
      editLabel={t("contacts.detail.editProfile")}
      onRestore={onRestore ? () => onRestore(contact.id) : undefined}
      onEdit={() => onEdit(contact)}
    />
  );
}

export interface ContactDetailDrawerArchivedBannerProps {
  contact: Contact;
}

export function ContactDetailDrawerArchivedBanner({
  contact,
}: ContactDetailDrawerArchivedBannerProps): React.JSX.Element | null {
  return <ContactArchivedBanner contact={contact} />;
}

export interface ContactDetailDrawerTabBarProps {
  detailTabs: readonly SubTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ContactDetailDrawerTabBar({
  detailTabs,
  activeTab,
  onTabChange,
}: ContactDetailDrawerTabBarProps): React.JSX.Element | null {
  return (
    <SubTabBar
      tabs={detailTabs}
      value={activeTab}
      onChange={onTabChange}
      variant="underline"
      panelIdPrefix="contact-detail-drawer"
      resetScrollOnChange={false}
      className="w-full pt-1"
    />
  );
}

export interface ContactDetailDrawerFooterProps {
  contact: Contact;
}

export function ContactDetailDrawerFooter({
  contact,
}: ContactDetailDrawerFooterProps): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <DrawerUpdatedStamp
      updatedAt={contact.updatedAt}
      createdAt={contact.createdAt}
      label={t("contacts.detail.updatedLabel")}
    />
  );
}
