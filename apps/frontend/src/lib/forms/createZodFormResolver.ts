import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";
import {
  toValidationErrors,
  type ValidationError,
  type ValidationErrorOptions,
} from "./validationErrors";

/** Sentinel key under which the structured `ValidationError[]` is stashed on `formState.errors`. */
export const VALIDATION_ERRORS_KEY = "__validationErrors";

type ValidationErrorsCarrier = { [VALIDATION_ERRORS_KEY]?: ValidationError[] };

/** Reads the structured errors a `createZodFormResolver` run attached to RHF (tab-aware flows). */
export function readValidationErrors<T extends Record<string, unknown>>(
  errors: FieldErrors<T>,
): ValidationError[] {
  return (errors as unknown as ValidationErrorsCarrier)[VALIDATION_ERRORS_KEY] ?? [];
}

function setFieldError(
  errors: Record<string, unknown>,
  path: PropertyKey[],
  error: { type: string; message: string },
): void {
  if (path.length === 0) {
    errors.root = error;
    return;
  }
  let cursor: Record<string, unknown> = errors;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index] as string | number;
    const next = path[index + 1];
    const existing = cursor[key];
    if (typeof next === "number") {
      if (!Array.isArray(existing)) cursor[key] = [];
    } else if (typeof existing !== "object" || existing === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1] as string] = error;
}

/**
 * `zodResolver`-equivalent that ALSO exposes the shared `ValidationError[]`
 * (fieldId/tabId/index) via {@link readValidationErrors}, so an RHF form can do
 * tab-aware error navigation the same way the hand-rolled tabbed forms do.
 *
 * Field-level messages are normalized through `options.resolveMessage` so Zod
 * message keys render as translated copy without a per-field wrapper.
 */
export function createZodFormResolver<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
  options: ValidationErrorOptions = {},
): Resolver<z.output<TSchema>> {
  return (async (values: z.output<TSchema>) => {
    const parsed = await schema.safeParseAsync(values);

    if (parsed.success) {
      return { values: parsed.data as z.output<TSchema>, errors: {} };
    }

    const errors: Record<string, unknown> = {};
    for (const issue of parsed.error.issues) {
      const message = options.resolveMessage ? options.resolveMessage(issue.message) : issue.message;
      setFieldError(errors, issue.path as PropertyKey[], { type: issue.code, message });
    }
    (errors as ValidationErrorsCarrier)[VALIDATION_ERRORS_KEY] = toValidationErrors(
      parsed.error,
      options,
    );

    return { values, errors: errors as unknown as FieldErrors<z.output<TSchema>> };
  }) as unknown as Resolver<z.output<TSchema>>;
}
