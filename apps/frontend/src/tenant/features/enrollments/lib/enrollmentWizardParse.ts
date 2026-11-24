import { enrollmentRecordInsertSchema, type EnrollmentInsert } from "@mms/contracts";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";

export type EnrollmentPayloadParseResult =
  { ok: true; data: EnrollmentInsert } | { ok: false; message: string };

/** Validate the wizard draft against the same write contract the API enforces. */
export function parseEnrollmentInsertPayload(
  payload: unknown,
  resolveMessage: (message: string) => string,
): EnrollmentPayloadParseResult {
  const parsed = enrollmentRecordInsertSchema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors = mapZodFormErrors(parsed.error, resolveMessage);
  return { ok: false, message: Object.values(fieldErrors).filter(Boolean).join(" · ") };
}
