import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { students } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Active students whose GR matches any of the given values (case-insensitive).
 * Returns a map of normalized GR → owning student id for bulk-restore conflict checks.
 */
export async function findActiveGrNumberOwnersSql(
  tenant: string,
  grNumbers: string[],
): Promise<Map<string, string>> {
  const subdomain = tenant.trim().toLowerCase();
  const normalized = [
    ...new Set(grNumbers.map((gr) => gr.trim().toLowerCase()).filter((gr) => gr.length > 0)),
  ];
  if (normalized.length === 0) return new Map();

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: students.id,
        grNumber: students.grNumber,
      })
      .from(students)
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          isNull(students.deletedAt),
          isNotNull(students.grNumber),
          sql`lower(btrim(${students.grNumber})) IN (${sql.join(
            normalized.map((gr) => sql`${gr}`),
            sql`, `,
          )})`,
        ),
      );
    const owners = new Map<string, string>();
    for (const row of rows) {
      const key = (row.grNumber ?? "").trim().toLowerCase();
      if (key) owners.set(key, String(row.id));
    }
    return owners;
  });
}

/**
 * Active students whose studentId matches any of the given values (case-insensitive).
 * Returns a map of normalized studentId → owning student id for bulk-restore conflict checks.
 */
export async function findActiveStudentIdOwnersSql(
  tenant: string,
  studentIds: string[],
): Promise<Map<string, string>> {
  const subdomain = tenant.trim().toLowerCase();
  const normalized = [
    ...new Set(studentIds.map((sid) => sid.trim().toLowerCase()).filter((sid) => sid.length > 0)),
  ];
  if (normalized.length === 0) return new Map();

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: students.id,
        studentId: students.studentId,
      })
      .from(students)
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          isNull(students.deletedAt),
          isNotNull(students.studentId),
          sql`lower(btrim(${students.studentId})) IN (${sql.join(
            normalized.map((sid) => sql`${sid}`),
            sql`, `,
          )})`,
        ),
      );
    const owners = new Map<string, string>();
    for (const row of rows) {
      const key = (row.studentId ?? "").trim().toLowerCase();
      if (key) owners.set(key, String(row.id));
    }
    return owners;
  });
}
