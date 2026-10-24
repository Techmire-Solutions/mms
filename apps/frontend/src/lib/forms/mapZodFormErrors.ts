import type { z } from "zod";

/** Maps the first Zod issue for each top-level field to display-ready copy. */
export function mapZodFormErrors(
  error: z.ZodError,
  resolveMessage: (message: string) => string,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === undefined) continue;
    const fieldKey = String(field);
    fieldErrors[fieldKey] ??= resolveMessage(issue.message);
  }

  return fieldErrors;
}
