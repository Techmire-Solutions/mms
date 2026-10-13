import React, { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  canManageTargetUser,
  editWorkspaceUserSchema,
  filterAssignableRoles,
  toTitleCase,
  type EditWorkspaceUserInput,
  type SystemUser,
  getInitials,
  getPrimaryEmail,
  getPrimaryPhone,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import { FormModal } from "@/components/app/FormModal";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { Form } from "@/components/ui/form";
import { firstZodFieldError } from "@/lib/forms/translateZodError";
import { notify } from "@/lib/notify";
import { EditUserModalFields } from "./EditUserModalFields";

export interface EditUserModalProps {
  user: SystemUser;
  onClose: () => void;
  onSave: (user: SystemUser) => void | Promise<void>;
}

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const workspaceRoles = useWorkspaceRoles();
  const { customFields } = useUsersConfig();
  const canManageThisUser = canManageTargetUser(authUser?.role, user.role);
  const roleLockedByFaculty = user.roleSource === "faculty_designations";
  const assignableRoles = useMemo(() => {
    const filtered = filterAssignableRoles(workspaceRoles, authUser?.role);
    if (!roleLockedByFaculty) return filtered;
    const current = workspaceRoles.find((r) => r.id === user.role);
    if (current && !filtered.some((r) => r.id === current.id)) {
      return [...filtered, current];
    }
    if (!current && user.role) {
      return [
        ...filtered,
        {
          id: user.role,
          labelKey: "users.role.custom" as const,
          descriptionKey: "users.role.customDesc" as const,
          customLabel: user.role,
          isSystem: false,
          badgeVariant: "primary" as const,
          permissions: {},
          managedBy: "faculty_designations" as const,
        },
      ];
    }
    return filtered;
  }, [workspaceRoles, authUser?.role, roleLockedByFaculty, user.role]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EditWorkspaceUserInput & Record<string, unknown>>({
    resolver: zodResolver(editWorkspaceUserSchema),
    defaultValues: {
      contactId: user.contactId ?? "",
      role: user.role,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      ...Object.fromEntries(
        customFields.map((cf) => [cf.id, user[cf.id] ?? cf.defaultValue ?? ""]),
      ),
    },
  });

  const customFieldsKey = customFields.map((cf) => `${cf.id}:${cf.defaultValue ?? ""}`).join(",");

  useEffect(() => {
    form.reset({
      contactId: user.contactId ?? "",
      role: user.role,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      ...Object.fromEntries(
        customFields.map((cf) => [cf.id, user[cf.id] ?? cf.defaultValue ?? ""]),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the granular user fields + customFieldsKey; adding `user`/`customFields`/`form` would re-run form.reset on unrelated re-renders and wipe in-progress edits.
  }, [user.id, user.contactId, user.role, user.status, user.twoFactorEnabled, customFieldsKey]);

  const watchedContactId = form.watch("contactId");
  const { data: selectedContact, isLoading: isLoadingContact } = useContactById(
    watchedContactId ? String(watchedContactId) : undefined,
    Boolean(watchedContactId),
  );

  const handleSave = form.handleSubmit(async (values) => {
    const contact = selectedContact;
    if (!contact && watchedContactId) return;

    const name = contact ? (toTitleCase(contact.name.trim()) as string) : user.name;
    const email = contact ? (getPrimaryEmail(contact) || "").toLowerCase() : user.email;
    const phone = contact ? getPrimaryPhone(contact) || "" : user.phone || "";
    const customFieldValues = Object.fromEntries(
      customFields.map((cf) => [cf.id, values[cf.id] ?? user[cf.id] ?? ""]),
    );

    setSubmitting(true);
    try {
      await onSave({
        ...user,
        contactId: contact?.id || user.contactId,
        name,
        email,
        phone,
        role: values.role,
        status: values.status,
        twoFactorEnabled: values.twoFactorEnabled,
        avatarInitials: getInitials(name),
        ...customFieldValues,
      });
      onClose();
    } catch (error: unknown) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("users.editTitle")}
      subtitle={selectedContact?.name || user.name}
      icon={User}
      error={firstZodFieldError(form.formState.errors, t) || undefined}
      cancelLabel={t("users.cancel")}
      saveLabel={t("users.saveChanges")}
      onSave={() => {
        void handleSave();
      }}
      saving={submitting}
      saveDisabled={
        !canManageThisUser || !watchedContactId || isLoadingContact || !form.formState.isDirty
      }
      formId="edit-user-form"
    >
      <Form {...form}>
        <EditUserModalFields
          form={form}
          user={user}
          canManageThisUser={canManageThisUser}
          roleLockedByFaculty={roleLockedByFaculty}
          assignableRoles={assignableRoles}
          customFields={customFields}
          onSubmit={handleSave}
        />
      </Form>
    </FormModal>
  );
}
