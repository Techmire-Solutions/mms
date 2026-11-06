import { useMemo } from "react";
import { deriveSiblingLinks, type Contact } from "@mms/shared";
import { collectLinkedContactIds, mergeContactLinkDirectory } from "@/lib/contacts/contactLinkIds";
import { useContactsByIds } from "@/tenant/features/contacts/hooks/useContacts";

export function useContactsDirectoryLinks({
  workContacts,
  editContact,
  viewContact,
}: {
  workContacts: Contact[];
  editContact: Contact | null;
  viewContact: Contact | null;
}) {
  const linkSourceContacts = useMemo(() => {
    const rows = [...workContacts];
    if (editContact) rows.push(editContact);
    if (viewContact) rows.push(viewContact);
    return rows;
  }, [workContacts, editContact, viewContact]);

  const siblingSubjects = useMemo(() => {
    const subjects: Contact[] = [];
    if (viewContact) subjects.push(viewContact);
    if (editContact) subjects.push(editContact);
    return subjects;
  }, [editContact, viewContact]);

  const linkedContactIds = useMemo(
    () => collectLinkedContactIds(linkSourceContacts),
    [linkSourceContacts],
  );

  // Only resolve deep secondary/sibling links when a contact drawer or form is active.
  // The directory table only requires the direct contact summary rows.
  const hasActiveOverlay = Boolean(editContact || viewContact);

  const { data: resolvedLinkContacts = [] } = useContactsByIds(
    hasActiveOverlay ? linkedContactIds : [],
    hasActiveOverlay,
  );

  const partialDirectory = useMemo(
    () =>
      hasActiveOverlay
        ? mergeContactLinkDirectory(linkSourceContacts, resolvedLinkContacts)
        : linkSourceContacts,
    [hasActiveOverlay, linkSourceContacts, resolvedLinkContacts],
  );

  const siblingContactIds = useMemo(() => {
    if (!hasActiveOverlay) return [];
    const knownIds = new Set(
      partialDirectory
        .map((contact) => (contact.id == null ? "" : String(contact.id).trim()))
        .filter(Boolean),
    );
    const ids = new Set<string>();
    for (const subject of siblingSubjects) {
      for (const link of deriveSiblingLinks(subject, partialDirectory)) {
        if (!knownIds.has(link.contactId)) ids.add(link.contactId);
      }
    }
    return [...ids];
  }, [hasActiveOverlay, partialDirectory, siblingSubjects]);

  const { data: resolvedSiblingContacts = [] } = useContactsByIds(
    hasActiveOverlay ? siblingContactIds : [],
    hasActiveOverlay,
  );

  return useMemo(
    () =>
      hasActiveOverlay
        ? mergeContactLinkDirectory(partialDirectory, resolvedSiblingContacts)
        : linkSourceContacts,
    [hasActiveOverlay, partialDirectory, resolvedSiblingContacts, linkSourceContacts],
  );
}
