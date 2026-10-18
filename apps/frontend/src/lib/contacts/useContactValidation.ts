import { contactWriteSchema, formatZodIssues, type ValidationError } from "@mms/shared";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

export function useContactValidation(): (contactDraft: unknown) => ValidationError[] {
  const settings = useGlobalSettings();

  return (contactDraft: unknown): ValidationError[] => {
    const result = contactWriteSchema.safeParse(contactDraft);
    if (result.success) {
      return [];
    }
    // Provide an empty fields map since we removed dynamic custom fields
    return formatZodIssues(result.error, contactDraft, {}, settings.language);
  };
}
