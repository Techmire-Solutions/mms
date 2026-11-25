import {
  findContactUniqueFieldConflicts,
  isChronologicalDateRangeValid,
  validatePhoneNumberByCountry,
  type Contact,
  type FieldDefinition,
  type ValidationError,
} from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ValidateContactDraftOptions {
  cleanedDraft: Partial<Contact>;
  fields: Record<string, FieldDefinition[]> | null | undefined;
  language: string;
  /** Setup Fields predicate — a disabled/optional field must not block save. */
  isFieldRequired: (tabId: string, fieldId: string) => boolean;
  validateBase: (draft: Partial<Contact>) => ValidationError[];
  t: TranslationFunction;
  defaultCountryCode?: string;
}

export function validateContactDraftErrors({
  cleanedDraft,
  fields,
  language,
  isFieldRequired,
  validateBase,
  t,
  defaultCountryCode = "",
}: ValidateContactDraftOptions): ValidationError[] {
  const formErrors = validateBase(cleanedDraft);

  if (isFieldRequired("basic", "gender") && (!cleanedDraft.gender || !cleanedDraft.gender.trim())) {
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

  if (Array.isArray(cleanedDraft.phones)) {
    cleanedDraft.phones.forEach((phone, idx) => {
      if (phone?.number && phone.number.trim()) {
        const country = phone.countryCode || defaultCountryCode;
        const res = validatePhoneNumberByCountry(phone.number, country, { language, t });
        if (!res.isValid) {
          const existing = formErrors.find(
            (err) => err.tabId === "phones" && err.fieldId === "number" && err.index === idx,
          );
          if (existing) {
            existing.message = res.error || existing.message;
          } else {
            formErrors.push({
              fieldId: "number",
              tabId: "phones",
              index: idx,
              message: res.error || t("contacts.validation.phoneInvalidGeneric"),
            });
          }
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
