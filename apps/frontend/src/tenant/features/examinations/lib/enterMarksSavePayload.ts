import type { z } from "zod";
import { examMarksWriteListSchema } from "@mms/shared";

export type MarksWriteRow = z.infer<typeof examMarksWriteListSchema>[number];

export type MarksSavePayloadParse =
  { ok: true; data: MarksWriteRow[] } | { ok: false; message: string };

/** Validate the marks grid against the same write contract the results endpoint enforces. */
export function parseMarksSavePayload(rows: unknown): MarksSavePayloadParse {
  const parsed = examMarksWriteListSchema.safeParse(rows);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "" };
}
