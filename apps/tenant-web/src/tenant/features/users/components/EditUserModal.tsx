import React, { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
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
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { validateUserCustomFields } from "@/tenant/features/users/lib/userCustomFieldValidation";
import { Form } from "@mms/ui/form";
import { firstZodFieldError } from "@mms/fe-core/forms/translateZodError";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { EditUserModalFields } from "./EditUserModalFields";

export interface EditUserModalProps {
  user: SystemUser;
  onClose: () => void;
  onSave: (user: SystemUser) => void | Promise<void>;
}

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps): React.JSX.Element {
  const { t, language } = useTranslation();
  const { user: authUser } = useAuth();
  const workspaceRoles = useWorkspaceRoles();
  const { customFields } = useUsersConfig();
  const canManageThisUser = canManageTargetUser(authUser?.role, user.role);
  const isSelf = Boolean(authUser && String(user.id) === String(authUser.id));
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
  const [serverError, setServerError] = useState<string | null>(null);
  const guardSave = useSubmitGuard();

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

  // All three deps are stable while the modal is open: `form` (useForm returns a
  // referentially stable object), `user` (the `editing` snapshot lives in modal-layer
  // state), and `customFields` (memoized by `useUsersConfig` on the settings object,
  // which TanStack Query keeps referentially stable via structural sharing). The reset
  // therefore only fires when the edited user or the custom-field definitions change.
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
  }, [form, user, customFields]);

  const watchedContactId = useWatch({ control: form.control, name: "contactId" });
  const { data: selectedContact, isLoading: isLoadingContact } = useContactById(
    watchedContactId ? String(watchedContactId) : undefined,
    Boolean(watchedContactId),
  );

  const submitUser = form.handleSubmit(async (values) => {
    if (!assignableRoles.some((role) => role.id === values.role)) {
      form.setError("role", { type: "manual", message: t("users.addErrorRole") });
      return;
    }
    // Self-protection mirrors the backend guard: an admin cannot change their own
    // role, or move their own account off "active", through the admin endpoint.
    if (isSelf && values.role !== user.role) {
      form.setError("role", { type: "manual", message: t("users.errors.cannotEditSelfRole") });
      return;
    }
    if (isSelf && values.status !== "active") {
      form.setError("status", { type: "manual", message: t("users.errors.cannotEditSelfStatus") });
      return;
    }
    const contact = selectedContact;
    if (!contact && watchedContactId) return;

    const customErrors = validateUserCustomFields(customFields, values, language);
    if (Object.keys(customErrors).length > 0) {
      for (const [key, message] of Object.entries(customErrors)) {
        form.setError(key as Parameters<typeof form.setError>[0], {
          type: "manual",
          message,
        });
      }
      return;
    }

    const name = contact ? (toTitleCase(contact.name.trim()) as string) : user.name;
    const email = contact ? (getPrimaryEmail(contact) || "").toLowerCase() : user.email;
    const phone = contact ? getPrimaryPhone(contact) || "" : user.phone || "";
    const customFieldValues = Object.fromEntries(
      customFields.map((cf) => [cf.id, values[cf.id] ?? user[cf.id] ?? ""]),
    );

    setServerError(null);
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
      // Field-level contract errors belong on the fields; the banner carries the
      // form-level reason. A toast alone left the modal looking like a no-op.
      const mapped = mapApiFormError(error);
      if (mapped.fieldErrors) {
        for (const [field, message] of Object.entries(mapped.fieldErrors)) {
          form.setError(field as keyof EditWorkspaceUserInput & string, {
            type: "server",
            message,
          });
        }
      }
      setServerError(mapped.message ?? t("errors.module.description"));
    } finally {
      setSubmitting(false);
    }
  });

  const handleSave = (): Promise<void | undefined> => guardSave(() => submitUser());

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("users.editTitle")}
      subtitle={selectedContact?.name || user.name}
      icon={User}
      error={serverError ?? (firstZodFieldError(form.formState.errors, t) || undefined)}
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
