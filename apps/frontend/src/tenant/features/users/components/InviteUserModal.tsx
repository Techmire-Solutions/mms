import React, { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  filterAssignableRoles,
  inviteWorkspaceUserSchema,
  toTitleCase,
  type InviteWorkspaceUserInput,
  type SystemUser,
  getInitials,
  todayISO,
  getPrimaryEmail,
  getPrimaryPhone,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import { FormModal } from "@/components/app/FormModal";
import { Form } from "@/components/ui/form";
import { firstZodFieldError } from "@/lib/forms/translateZodError";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { InviteUserFormFields } from "@/tenant/features/users/components/InviteUserFormFields";

export interface InviteUserModalProps {
  onClose: () => void;
  onInvite: (user: SystemUser) => void | Promise<void>;
  existingContactIds?: (string | number)[];
}

export function InviteUserModal({
  onClose,
  onInvite,
  existingContactIds = [],
}: InviteUserModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const workspaceRoles = useWorkspaceRoles();
  const assignableRoles = useMemo(
    () => filterAssignableRoles(workspaceRoles, authUser?.role),
    [workspaceRoles, authUser?.role],
  );
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const excludeIds = (() => existingContactIds.map(String))();

  const form = useForm<InviteWorkspaceUserInput>({
    resolver: zodResolver(inviteWorkspaceUserSchema),
    defaultValues: {
      contactId: "",
      role: "",
      status: "inactive",
      sendEmail: true,
    },
  });

  const watchedContactId = form.watch("contactId");
  const { data: selectedContact, isLoading: isLoadingContact } = useContactById(
    watchedContactId ? String(watchedContactId) : undefined,
    Boolean(watchedContactId),
  );

  const handleSave = form.handleSubmit(async (values) => {
    if (!assignableRoles.some((role) => role.id === values.role)) {
      form.setError("role", { type: "manual", message: t("users.addErrorRole") });
      return;
    }
    const contact = selectedContact;
    if (!contact) {
      form.setError("contactId", { type: "manual", message: "users.addErrorContact" });
      return;
    }
    setServerError(null);
    const name = toTitleCase(contact.name.trim()) as string;
    const email = (getPrimaryEmail(contact) || "").toLowerCase();
    const phone = getPrimaryPhone(contact) || "";
    const user = {
      id: `u${crypto.randomUUID()}`,
      contactId: contact.id,
      name,
      email,
      phone,
      role: values.role,
      status: values.status,
      avatarInitials: getInitials(name),
      lastLogin: "",
      createdDate: todayISO(),
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
      activeSessions: 0,
      sendEmail: values.sendEmail,
    } satisfies SystemUser & { sendEmail: boolean };
    setSubmitting(true);
    try {
      await onInvite(user);
      onClose();
    } catch (error: unknown) {
      const mapped = mapApiFormError(error);
      if (mapped.fieldErrors) {
        for (const [field, message] of Object.entries(mapped.fieldErrors)) {
          form.setError(field as keyof InviteWorkspaceUserInput, { type: "manual", message });
        }
      }
      setServerError(mapped.message ?? t("errors.module.description"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("users.inviteTitle")}
      subtitle={t("users.inviteSubtitle")}
      icon={UserPlus}
      error={serverError ?? firstZodFieldError(form.formState.errors, t) ?? undefined}
      cancelLabel={t("users.cancel")}
      saveLabel={t("users.inviteSubmit")}
      onSave={async () => {
        await handleSave();
      }}
      saving={submitting}
      saveDisabled={submitting || !watchedContactId || isLoadingContact}
      formId="invite-user-form"
    >
      <Form {...form}>
        <form id="invite-user-form" noValidate className="space-y-4" onSubmit={handleSave}>
          <InviteUserFormFields
            form={form}
            excludeIds={excludeIds}
            assignableRoles={assignableRoles}
            t={t}
          />
        </form>
      </Form>
    </FormModal>
  );
}
