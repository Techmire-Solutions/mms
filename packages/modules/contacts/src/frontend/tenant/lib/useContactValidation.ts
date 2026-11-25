import { useMemo } from "react";
import {
  buildContactWriteSchema,
  buildDynamicContactSchema,
  collectContactWriteExtraFieldKeys,
  formatZodIssues,
  type FieldConfig,
  type ValidationError,
} from "@mms/contracts";
import { useContactConfig } from "../components/ContactConfigContext.js";
import { useGlobalSettings } from "@mms/fe-core/lib/useGlobalSettings";
import { usePermissions } from "../hooks/usePermissions.js";

function issueKey(issue: ValidationError): string {
  return `${issue.tabId}|${issue.fieldId}|${issue.index ?? ""}|${issue.message}`;
}

/**
 * Contact form validation.
 *
 * Two rule sets, merged: the static wire DTO (shape/type guards shared with the
 * server's Fastify schema) and the tenant's field blueprint (enabled/required
 * tabs and per-field required/type rules). The server enforces the blueprint on
 * every write, so validating it here too keeps required-field errors inline and
 * avoids a guaranteed 400 round-trip.
 */
export function useContactValidation(): (contactDraft: unknown) => ValidationError[] {
  const settings = useGlobalSettings();
  const { fields, enabledTabIds, requiredTabIds, formTabs, fieldConfigVersion } =
    useContactConfig();
  const { role } = usePermissions();
  const viewerRole = role ?? undefined;
  const language = settings.language;

  return useMemo(() => {
    const enabledTabs = [...enabledTabIds];
    const requiredTabs = [...requiredTabIds];
    const fieldConfig: FieldConfig = {
      version: fieldConfigVersion,
      enabledTabs,
      requiredTabs,
      fields,
      ...(formTabs ? { formTabs } : {}),
    };
    const writeSchema = buildContactWriteSchema(collectContactWriteExtraFieldKeys(fieldConfig));
    const dynamicSchema = buildDynamicContactSchema(
      fieldConfig,
      new Set(enabledTabs),
      new Set(requiredTabs),
      fields,
      language,
      viewerRole,
    );

    return (contactDraft: unknown): ValidationError[] => {
      const errors: ValidationError[] = [];
      const parsedBase = writeSchema.safeParse(contactDraft);
      if (!parsedBase.success) {
        errors.push(...formatZodIssues(parsedBase.error, contactDraft, fields, language));
      }

      const parsedDynamic = dynamicSchema.safeParse(contactDraft);
      if (parsedDynamic.success) {
        return errors;
      }

      const seen = new Set(errors.map(issueKey));
      for (const issue of formatZodIssues(parsedDynamic.error, contactDraft, fields, language)) {
        const key = issueKey(issue);
        if (!seen.has(key)) {
          seen.add(key);
          errors.push(issue);
        }
      }
      return errors;
    };
  }, [fields, enabledTabIds, requiredTabIds, formTabs, fieldConfigVersion, language, viewerRole]);
}
