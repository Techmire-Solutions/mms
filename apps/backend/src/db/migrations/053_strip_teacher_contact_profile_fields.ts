/**
 * Strip contact-owned identity dual-write keys from teachers.custom_data.
 * Contacts remain SSOT for name, phone, email, gender, dob, city, first/last name.
 * Idempotent: only updates rows that still contain any of the keys.
 */
import { sql } from "drizzle-orm";
import { withGlobalTenant } from "../tenant-context.js";

export async function runMigration053(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    const colCheck = (await tx.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'custom_data'
    `)) as unknown;
    const hasCustomData =
      typeof colCheck === "object" && colCheck !== null && "rowCount" in colCheck
        ? Number((colCheck as { rowCount?: number }).rowCount ?? 0) > 0
        : Array.isArray(colCheck) && (colCheck as unknown[]).length > 0;

    if (!hasCustomData) {
      console.log("[Migration 053] No teacher custom_data column to strip.");
      return;
    }

    const result = await tx.execute(sql`
      UPDATE teachers
      SET
        custom_data = custom_data
          - 'name' - 'phone' - 'email' - 'gender' - 'dob' - 'city'
          - 'firstName' - 'lastName',
        updated_at = NOW()
      WHERE custom_data ?| ARRAY[
        'name', 'phone', 'email', 'gender', 'dob', 'city',
        'firstName', 'lastName'
      ]::text[]
    `);

    const rowCount =
      typeof result === "object" && result !== null && "rowCount" in result
        ? Number((result as { rowCount?: number }).rowCount ?? 0)
        : 0;

    if (rowCount > 0) {
      console.log(
        `[Migration 053] Stripped contact profile dual-write keys from ${rowCount} teacher row(s).`,
      );
    } else {
      console.log("[Migration 053] No teacher custom_data profile keys to strip.");
    }
  });
}
