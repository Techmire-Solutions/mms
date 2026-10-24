import {
  findContactUniqueFieldConflicts,
  isChronologicalDateRangeValid,
  type Contact,
  type FieldDefinition,
  type ValidationError,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ValidateContactDraftOptions {
  cleanedDraft: Partial<Contact>;
  fields: Record<string, FieldDefinition[]> | null | undefined;
  language: string;
  validateBase: (draft: Partial<Contact>) => ValidationError[];
  t: TranslationFunction;
}

export function validateContactDraftErrors({
  cleanedDraft,
  fields,
  language,
  validateBase,
  t,
}: ValidateContactDraftOptions): ValidationError[] {
  const formErrors = validateBase(cleanedDraft);

  if (!cleanedDraft.gender || !cleanedDraft.gender.trim()) {
    formErrors.push({
      fieldId: "gender",
      tabId: "basic",
      message: t("contacts.validation.required", { label: t("contacts.fields.gender") }),
    });
  }

  if (cleanedDraft.cnic) {
    const cleanCnic = cleanedDraft.cnic.replace(/\D/g, "");
    if (cleanCnic.length > 0 && cleanCnic.length !== 13) {
      formErrors.push({
        fieldId: "cnic",
        tabId: "basic",
        message: t("contacts.form.cnicInvalid"),
      });
    }
  }

  if (typeof cleanedDraft.avatar === "string" && cleanedDraft.avatar.startsWith("data:")) {
    formErrors.push({
      fieldId: "avatar",
      tabId: "basic",
      message: t("contacts.form.avatarMustUpload"),
    });
  }

  if (Array.isArray(cleanedDraft.experience)) {
    cleanedDraft.experience.forEach((exp, idx) => {
      if (!exp.isCurrent && exp.startDate && exp.endDate) {
        if (!isChronologicalDateRangeValid(exp.startDate, exp.endDate)) {
          formErrors.push({
            fieldId: "endDate",
            tabId: "experience",
            index: idx,
            message: t("contacts.form.startDateBeforeEndDate"),
          });
        }
      }
    });
  }

  // Check unique fields (phone number, email address, CNIC, etc.) within the candidate draft
  if (fields) {
    const uniqueErrors = findContactUniqueFieldConflicts(cleanedDraft, [], fields, language);
    if (uniqueErrors.length > 0) {
      formErrors.push(...uniqueErrors);
    }
  }

  return formErrors;
}
