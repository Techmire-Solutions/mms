import type { Faculty } from "@mms/shared";

/**
 * Applies a just-saved patch to the drawer's snapshot record.
 *
 * The profile drawer reads a `useState` snapshot (so it survives list refetches),
 * which means a save it performs itself (leave, status) would otherwise leave the
 * open drawer showing pre-save values. Returns the same reference when the patch
 * does not target the open record, so React can skip the re-render.
 */
export function patchViewFaculty(
  prev: Faculty | null,
  facultyId: string,
  patch: Partial<Faculty>,
): Faculty | null {
  if (!prev || String(prev.id) !== String(facultyId)) return prev;
  return { ...prev, ...patch };
}
