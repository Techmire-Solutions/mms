import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Contact, type ContactActivity, todayISO } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  contactDetailQueryKey,
  fetchContactById,
} from "@/tenant/features/contacts/hooks/useContacts";

export function useContactDetailActions({
  allContacts,
  contactState,
  setContactState,
  canPersistContact,
  onUpdateContact,
  onNavigateToContact,
}: {
  allContacts: Contact[];
  contactState: Contact;
  setContactState: Dispatch<SetStateAction<Contact>>;
  canPersistContact: boolean;
  onUpdateContact?: (contact: Contact) => Promise<void>;
  onNavigateToContact?: (targetId: string | number) => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleAddNote = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || !canPersistContact || !onUpdateContact) return false;

      const newActivity: ContactActivity = {
        id: `act-${crypto.randomUUID()}`,
        type: "note",
        content: trimmed,
        date: todayISO(),
        by: user?.name || t("contacts.detail.systemUser"),
      };

      const previousContact = contactState;
      const updatedContact = {
        ...contactState,
        activities: [newActivity, ...(contactState.activities || [])],
      };

      setContactState(updatedContact);

      try {
        await onUpdateContact(updatedContact);
        return true;
      } catch {
        setContactState(previousContact);
        notify.error(t("contacts.detail.noteSaveFailed"));
        return false;
      }
    },
    [canPersistContact, contactState, onUpdateContact, setContactState, t, user?.name],
  );

  const handleNavigateToContact = useCallback(
    (targetId: string | number): void => {
      if (onNavigateToContact) {
        onNavigateToContact(targetId);
        return;
      }

      const target = allContacts.find((contact) => String(contact.id) === String(targetId));
      if (target) {
        setContactState(target);
        return;
      }

      const contactId = String(targetId);
      void queryClient
        .fetchQuery({
          queryKey: contactDetailQueryKey(contactId),
          queryFn: ({ signal }) => fetchContactById(contactId, signal),
        })
        .then((contact) => {
          if (contact) {
            setContactState(contact);
          }
        })
        .catch(() => {
          notify.error(t("contacts.detail.loadFailed"));
        });
    },
    [allContacts, onNavigateToContact, queryClient, setContactState, t],
  );

  return {
    handleAddNote,
    handleNavigateToContact,
  };
}
