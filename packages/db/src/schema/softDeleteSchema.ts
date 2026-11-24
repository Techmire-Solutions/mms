import { boolean, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Creates fresh soft-delete column builder definitions matching the 4-Bucket deletion taxonomy (§2.1).
 * Use Date objects for timestamp fields with mode: 'date'.
 */
export function getSoftDeleteColumns() {
  return {
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: text("deleted_by"),
    deletionReason: varchar("deletion_reason", { length: 500 }),
    restoredAt: timestamp("restored_at", { withTimezone: true, mode: "date" }),
    restoredBy: text("restored_by"),
    deletedWithCascade: boolean("deleted_with_cascade").default(false),
  };
}

/**
 * Reusable soft-delete column definitions with dynamic property getters.
 * Using property getters ensures every spread `{ ...softDeleteColumns }` generates
 * fresh, table-bound column builders preventing cross-table builder contamination in Drizzle.
 */
export const softDeleteColumns = {
  get deletedAt() {
    return timestamp("deleted_at", { withTimezone: true, mode: "date" });
  },
  get deletedBy() {
    return text("deleted_by");
  },
  get deletionReason() {
    return varchar("deletion_reason", { length: 500 });
  },
  get restoredAt() {
    return timestamp("restored_at", { withTimezone: true, mode: "date" });
  },
  get restoredBy() {
    return text("restored_by");
  },
  get deletedWithCascade() {
    return boolean("deleted_with_cascade").default(false);
  },
};

export type SoftDeleteColumns = ReturnType<typeof getSoftDeleteColumns>;
