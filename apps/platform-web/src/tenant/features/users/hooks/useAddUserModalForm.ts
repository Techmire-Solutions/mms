import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import { useState } from "react";
import {
  createWorkspaceUserSchema,
  filterAssignableRoles,
  getInitials,
  toTitleCase,
  todayISO,
  validatePasswordPolicy,
  type SystemUser,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { notify } from "@mms/fe-core/notify";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { mapZodFormErrors } from "@mms/fe-core/forms/mapZodFormErrors";
import { validateUserCustomFields } from "../lib/userCustomFieldValidation";
import type { AddUserFormState } from "../lib/addUserModalTypes";

export interface UseAddUserModalFormProps {
  onAdd: (user: SystemUser) => void | Promise<void>;
  existingEmails: string[];
}

export function useAddUserModalForm({ onAdd, existingEmails }: UseAddUserModalFormProps) {
  const { t, language } = useTranslation();
  const { user: authUser } = useAuth();
  const workspaceRoles = useWorkspaceRoles();
  const assignableRoles = filterAssignableRoles(workspaceRoles, authUser?.role);
  const today = useWorkspaceToday();
  const { customFields } = useUsersConfig();
  const globalSettings = useGlobalSettings();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<AddUserFormState>({
    contactId: null,
    name: "",
    email: "",
    phone: "",
    role: "",
    status: "active",
    temporaryRole: false,
    roleExpiry: "",
    setupMethod: "invite",
    password: "",
    forceReset: true,
    twoFactorEnabled: false,
  });

  const validate = (): boolean => {
    const validationErrors: Record<string, string> = {};
    if (step === 1) {
      if (!form.contactId) validationErrors.contactId = t("users.addErrorContact");
      else if (!form.email.trim()) validationErrors.email = t("users.addErrorContactEmail");
      else if (existingEmails.includes(form.email.toLowerCase()))
        validationErrors.email = t("users.addErrorContactExists");
    }
    if (step === 2) {
      if (!form.role) validationErrors.role = t("users.addErrorRole");
      else if (!assignableRoles.some((role) => role.id === form.role)) {
        validationErrors.role = t("users.addErrorRole");
      }
      if (form.temporaryRole) {
        if (!form.roleExpiry) validationErrors.roleExpiry = t("users.addErrorRoleExpiry");
        else if (form.roleExpiry < today) {
          validationErrors.roleExpiry = t("users.addErrorRoleExpiryPast");
        }
      }
      Object.assign(
        validationErrors,
        validateUserCustomFields(
          customFields,
          form as unknown as Record<string, unknown>,
          language,
        ),
      );
    }
    if (step === 3 && form.setupMethod === "password") {
      if (!form.password) {
        validationErrors.password = t("users.addErrorPassword");
      } else {
        const policyResult = validatePasswordPolicy(form.password, globalSettings.passwordPolicy);
        if (!policyResult.valid) {
          validationErrors.password = policyResult.errorKey
            ? t(policyResult.errorKey)
            : policyResult.message;
        }
      }
    }
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleNext = (): void => {
    if (!validate()) return;
    setStep((currentStep) => currentStep + 1);
  };

  const handleBack = (): void => {
    setErrors({});
    setStep((currentStep) => currentStep - 1);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return;

    if (!assignableRoles.some((role) => role.id === form.role)) {
      setErrors({ role: t("users.addErrorRole") });
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }
    if (form.temporaryRole && (!form.roleExpiry || form.roleExpiry < today)) {
      setErrors({ roleExpiry: t("users.addErrorRoleExpiry") });
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }
    // The same write contract the users API enforces. The step checks above stay
    // for per-step UX; this is the final gate.
    const parsed = createWorkspaceUserSchema.safeParse({
      contactId: form.contactId,
      role: form.role,
      status: form.status,
      temporaryRole: form.temporaryRole,
      roleExpiry: form.roleExpiry,
      setupMethod: form.setupMethod,
      password: form.setupMethod === "password" ? form.password : undefined,
      forceReset: form.forceReset,
      twoFactorEnabled: form.twoFactorEnabled,
    });
    if (!parsed.success) {
      setErrors(
        mapZodFormErrors(parsed.error, (message) => translateValidationMessage(message, t)),
      );
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const newUser = {
      id: `u${crypto.randomUUID()}`,
      contactId: form.contactId!,
      name: toTitleCase(form.name.trim()) as string,
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      role: form.role,
      status: form.setupMethod === "invite" ? "inactive" : form.status,
      mustChangePassword: form.setupMethod === "password" ? form.forceReset !== false : false,
      temporaryPassword: form.setupMethod === "password" ? form.password : undefined,
      twoFactorEnabled: form.twoFactorEnabled,
      lastLogin: "",
      createdDate: todayISO(),
      failedLoginAttempts: 0,
      activeSessions: 0,
      avatarInitials: getInitials(form.name),
      setupMethod: form.setupMethod,
      password: form.setupMethod === "password" ? form.password : undefined,
      forceReset: form.forceReset,
      temporaryRole: form.temporaryRole,
      roleExpiry: form.temporaryRole ? form.roleExpiry : undefined,
      ...Object.fromEntries(
        customFields.map((customField) => [
          customField.id,
          form[customField.id] ?? customField.defaultValue ?? "",
        ]),
      ),
    } satisfies SystemUser & {
      setupMethod: AddUserFormState["setupMethod"];
      password?: string;
      forceReset?: boolean;
      temporaryRole?: boolean;
      roleExpiry?: string;
    };
    try {
      await onAdd(newUser);
      // Keep the modal mounted so the created-account summary is actually visible;
      // the Done action closes it.
      setSuccess(true);
    } catch (error: unknown) {
      const mapped = mapApiFormError(error);
      if (mapped.fieldErrors) setErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
      setFormError(mapped.message ?? t("errors.module.description"));
      if (!mapped.fieldErrors) {
        notify.error(t("errors.module.title"), {
          description: mapped.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    t,
    step,
    submitting,
    success,
    errors,
    formError,
    form,
    setForm,
    handleNext,
    handleBack,
    handleSubmit,
  };
}
