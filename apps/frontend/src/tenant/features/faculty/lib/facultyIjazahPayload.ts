import type { FacultyIjazah } from "@mms/shared";

/**
 * Normalizes the ijazah collection before the faculty write:
 * trims text, drops never-filled rows, and maps blank nullable fields to
 * `undefined` (the shared schema accepts null | string | number for `year`).
 */
export function sanitizeFacultyIjazahs(rows: readonly FacultyIjazah[]): FacultyIjazah[] {
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title.trim(),
      field: row.field,
      grantingAuthority: row.grantingAuthority.trim(),
      ...(typeof row.year === "number"
        ? { year: row.year }
        : { year: typeof row.year === "string" && row.year.trim() ? row.year.trim() : undefined }),
      ...(typeof row.sanadChain === "string" && row.sanadChain.trim()
        ? { sanadChain: row.sanadChain.trim() }
        : { sanadChain: undefined }),
    }))
    .filter((row) => row.title !== "" || row.grantingAuthority !== "");
}
