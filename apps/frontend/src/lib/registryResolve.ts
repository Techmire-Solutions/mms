/** Deduplicated non-empty registry ids for batch resolve (globle2 §10). */
export function uniqueRegistryIds(ids: (string | number | null | undefined)[]): string[] {
  return [
    ...new Set(
      ids.filter((id) => id !== null && id !== undefined && String(id).length > 0).map(String),
    ),
  ].sort();
}

export function collectFacultyIdsFromClasses(
  classes: { facultyId?: string | number | null }[] | undefined,
): string[] {
  return uniqueRegistryIds((classes ?? []).map((sessionClass) => sessionClass.facultyId));
}

export function collectFacultyIdsFromSessions(
  sessions: { classes?: { facultyId?: string | number | null }[] }[],
): string[] {
  return uniqueRegistryIds(
    sessions.flatMap((session) =>
      (session.classes ?? []).map((sessionClass) => sessionClass.facultyId),
    ),
  );
}
