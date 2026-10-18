import { DEFAULT_SESSION_CATEGORY_CODE, type Session } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { findAcademicCatalogIdByCodeTx } from "./academicCatalogReferences.js";
import { resolveCatalogRefsTx } from "./academicCatalogSnapshot.js";

/**
 * Server-side catalog resolution for a session write (client text is never authoritative):
 * - category: live id, else the default "Academic Year" category;
 * - program: live id, else matched from the legacy `type` text; `type` mirrors the program name;
 * - class program: live id, else the session's program;
 * - period subject: live id refreshes the `subject` snapshot, else matched by name.
 */
export async function resolveSessionCatalogRefsTx(
  tx: TenantTransaction,
  subdomain: string,
  record: Session,
): Promise<Session> {
  const [category] = await resolveCatalogRefsTx(tx, "categories", subdomain, [
    { id: record.categoryId },
  ]);
  const categoryId =
    category.id ??
    (await findAcademicCatalogIdByCodeTx(
      tx,
      "categories",
      subdomain,
      DEFAULT_SESSION_CATEGORY_CODE,
    ));
  const legacyType = record.type && record.type !== "academic" ? record.type : "";
  const [program] = await resolveCatalogRefsTx(tx, "programs", subdomain, [
    { id: record.programId, name: legacyType },
  ]);

  if (record.classes === undefined) {
    return {
      ...record,
      categoryId: categoryId ?? "",
      programId: program.id ?? "",
      type: program.id ? program.name : record.type,
    };
  }

  const classPrograms = await resolveCatalogRefsTx(
    tx,
    "programs",
    subdomain,
    record.classes.map((c) => ({ id: c.programId || program.id })),
  );
  const periods = record.classes.flatMap((c) =>
    (c.timetables ?? []).flatMap((t) => t.periods ?? []),
  );
  const subjectRefs = await resolveCatalogRefsTx(
    tx,
    "subjects",
    subdomain,
    periods.map((p) => ({ id: p.subjectId, name: p.subject })),
  );
  let periodIndex = 0;
  const classes = record.classes.map((c, classIndex) => ({
    ...c,
    programId: classPrograms[classIndex].id ?? "",
    timetables: (c.timetables ?? []).map((t) => ({
      ...t,
      periods: (t.periods ?? []).map((p) => {
        const ref = subjectRefs[periodIndex++];
        return { ...p, subjectId: ref.id ?? "", subject: ref.name || p.subject };
      }),
    })),
  }));

  return {
    ...record,
    categoryId: categoryId ?? "",
    programId: program.id ?? "",
    type: program.id ? program.name : record.type,
    classes,
  };
}
