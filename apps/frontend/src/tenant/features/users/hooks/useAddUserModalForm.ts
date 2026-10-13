import { useState } from "react";
import {
  getInitials,
  toTitleCase,
  todayISO,
  validatePasswordPolicy,
  type SystemUser,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { notify } from "@/lib/notify";
import type { AddUserFormState } from "../lib/addUserModalTypes";

export interface UseAddUserModalFormProps {
  onAdd: (user: SystemUser) => void | Promise<void>;
  onClose: () => void;
  existingEmails: string[];
}

export function useAddUserModalForm({ onAdd, onClose, existingEmails }: UseAddUserModalFormProps) {
  const { t } = useTranslation();
  const { customFields } = useUsersConfig();
  const globalSettings = useGlobalSettings();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      else if (!form.email.trim()) validationErrors.contactId = t("users.addErrorContactEmail");
      else if (existingEmails.includes(form.email.toLowerCase()))
        validationErrors.contactId = t("users.addErrorContactExists");
    }
    if (step === 2) {
      if (!form.role) validationErrors.role = t("users.addErrorRole");

      for (const customField of customFields) {
        if (customField.required) {
          const fieldValue = form[customField.id];
          if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
            validationErrors.role = t("users.addErrorFieldRequired", { label: customField.label });
          }
        }
      }
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
    setSubmitting(true);
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
      setSuccess(true);
      onClose();
    } catch (error: unknown) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
      });
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
    form,
    setForm,
    handleNext,
    handleBack,
    handleSubmit,
  };
}
