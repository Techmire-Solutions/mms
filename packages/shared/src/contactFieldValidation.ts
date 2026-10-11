import { z } from "zod";
import { translateApp, translateAppParams, type AppTranslationKey } from "./appTranslations.js";
import type { FieldDefinition } from "./contactTypes.js";
import { isAllowedRelationshipLabel } from "./contactRelationshipRules.js";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const TEXT_LIKE_FIELD_TYPES: ReadonlySet<FieldDefinition["type"]> = new Set([
  "text",
  "textarea",
  "email",
  "url",
  "date",
  "datetime",
  "select",
  "single_select",
  "currency",
]);

function isValidOption(options: unknown[], targetValue: string, fieldKey?: string): boolean {
  // Relationship labels are the fixed system catalog (prefs pairs are hardcoded).
  if (fieldKey === "relationship") {
    return isAllowedRelationshipLabel(targetValue);
  }
  const normalizedTarget = targetValue.trim().toLowerCase();
  return options.some(
    (option) => typeof option === "string" && option.trim().toLowerCase() === normalizedTarget,
  );
}

/** Absolute URL, scheme-less domain/path, or @handle / username. */
export function isUrlOrSocialHandle(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed)) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#]\S*)?$/i.test(trimmed)) return true;
  if (/^@[\w][\w.-]*$/.test(trimmed)) return true;
  return /^[\w][\w.-]*(\/[\w./-]*)?$/.test(trimmed);
}

function fieldLabel(fieldDefinition: FieldDefinition, language: string): string {
  if (fieldDefinition.labelKey) {
    return translateApp(fieldDefinition.labelKey as AppTranslationKey, language);
  }
  return fieldDefinition.label;
}

function msg(
  key: AppTranslationKey,
  language: string,
  vars?: Record<string, string | number>,
): string {
  return translateAppParams(key, language, vars as never);
}

/** Compiles a dynamic field validator from its field definition. */
export function buildCustomFieldSchema(
  fieldDefinition: FieldDefinition,
  language = "en",
): z.ZodTypeAny {
  let baseSchema: z.ZodTypeAny;
  const label = fieldLabel(fieldDefinition, language);

  switch (fieldDefinition.type) {
    case "text":
    case "textarea": {
      let stringSchema = z.string();
      if (fieldDefinition.minLength !== undefined) {
        stringSchema = stringSchema.min(
          fieldDefinition.minLength,
          msg("contacts.validation.minLength", language, {
            label,
            min: fieldDefinition.minLength,
          }),
        );
      }
      if (fieldDefinition.maxLength !== undefined) {
        stringSchema = stringSchema.max(
          fieldDefinition.maxLength,
          msg("contacts.validation.maxLength", language, {
            label,
            max: fieldDefinition.maxLength,
          }),
        );
      }
      baseSchema = stringSchema;
      break;
    }
    case "number": {
      let numberSchema = z.coerce.number({
        message: msg("contacts.validation.mustBeNumber", language, { label }),
      });
      if (fieldDefinition.min !== undefined) {
        numberSchema = numberSchema.min(
          fieldDefinition.min,
          msg("contacts.validation.minValue", language, {
            label,
            min: fieldDefinition.min,
          }),
        );
      }
      if (fieldDefinition.max !== undefined) {
        numberSchema = numberSchema.max(
          fieldDefinition.max,
          msg("contacts.validation.maxValue", language, {
            label,
            max: fieldDefinition.max,
          }),
        );
      }
      baseSchema = numberSchema;
      break;
    }
    case "email":
      baseSchema = z.string().regex(EMAIL_RE, {
        message: msg("contacts.validation.invalidEmail", language),
      });
      break;
    case "url":
      baseSchema = z.string().refine(isUrlOrSocialHandle, {
        message: msg("contacts.validation.invalidUrlOrHandle", language, { label }),
      });
      break;
    case "date":
      baseSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: msg("contacts.validation.invalidDate", language, { label }),
      });
      break;
    case "datetime":
      baseSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: msg("contacts.validation.invalidDateTime", language, { label }),
      });
      break;
    case "currency": {
      let currencySchema = z.string().refine((value) => !value || !Number.isNaN(Number(value)), {
        message: msg("contacts.validation.mustBeNumericString", language, { label }),
      });
      if (fieldDefinition.precision !== undefined) {
        const precision = fieldDefinition.precision;
        currencySchema = currencySchema.refine(
          (value) => !value || (value.split(".")[1] ?? "").length <= precision,
          {
            message: msg("contacts.validation.precisionExceeded", language, {
              label,
              precision,
            }),
          },
        );
      }
      baseSchema = currencySchema;
      break;
    }
    case "select":
    case "single_select":
      baseSchema = fieldDefinition.options?.length
        ? z
            .string()
            .refine(
              (value) =>
                !value || isValidOption(fieldDefinition.options ?? [], value, fieldDefinition.key),
              { message: msg("contacts.validation.invalidOption", language, { label }) },
            )
        : z.string();
      break;
    case "multiselect":
    case "multi_select":
      baseSchema = fieldDefinition.options?.length
        ? z
            .array(z.string())
            .refine(
              (values) =>
                values.every((value) =>
                  isValidOption(fieldDefinition.options ?? [], value, fieldDefinition.key),
                ),
              { message: msg("contacts.validation.invalidOptions", language, { label }) },
            )
        : z.array(z.string());
      break;
    case "tags":
      baseSchema = z.union([z.array(z.string()), z.string()]);
      break;
    case "boolean":
      baseSchema = z.coerce.boolean();
      break;
    case "file":
      baseSchema = z.union([
        z.string(),
        z.object({
          name: z.string(),
          url: z.string(),
          size: z.number().optional(),
          type: z.string().optional(),
        }),
      ]);
      break;
    case "location":
      baseSchema = z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional(),
      });
      break;
    case "ai_summary":
      baseSchema = z.string().optional();
      break;
    default:
      baseSchema = z.unknown();
  }

  const requiredMessage = msg("contacts.validation.required", language, { label });

  if (!fieldDefinition.required) {
    return z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      baseSchema.optional(),
    );
  }

  if (TEXT_LIKE_FIELD_TYPES.has(fieldDefinition.type)) {
    return z.preprocess(
      (value) => {
        if (typeof value === "number" || typeof value === "bigint") return String(value);
        if (typeof value === "string") return value.trim();
        return value;
      },
      baseSchema.refine((value) => typeof value === "string" && value.trim() !== "", {
        message: requiredMessage,
      }),
    );
  }
  if (fieldDefinition.type === "multiselect" || fieldDefinition.type === "multi_select") {
    return baseSchema.refine((value) => Array.isArray(value) && value.length > 0, {
      message: requiredMessage,
    });
  }
  if (fieldDefinition.type === "number") {
    return baseSchema.refine(
      (value) => value !== null && value !== undefined && !Number.isNaN(value as number),
      { message: requiredMessage },
    );
  }
  if (fieldDefinition.type === "boolean") {
    return baseSchema.refine((value) => value === true, {
      message: requiredMessage,
    });
  }
  if (fieldDefinition.type === "tags") {
    return baseSchema.refine(
      (value) =>
        Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim() !== "",
      { message: requiredMessage },
    );
  }
  return baseSchema;
}
