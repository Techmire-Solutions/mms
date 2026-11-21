import { DEFAULT_COLUMN_REGISTRY } from "./contactColumnRegistry.js";

/**
 * Server-supported Contacts Work sort keys — SSOT for the list/export ORDER BY
 * (`buildOrderBy`) and for which column headers / Filters-menu options offer sorting.
 * A key outside this set falls back to id order, so the UI must never offer it.
 */
export const CONTACT_SORT_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "firstName",
  "lastName",
  "gender",
  "isSyed",
  "tag",
  "dob",
  "cnic",
  "line1",
  "city",
  "state",
  "country",
  "createdAt",
  "updatedAt",
]);

const SORTABLE_COLUMN_FIELDS: ReadonlyMap<string, string> = new Map(
  DEFAULT_COLUMN_REGISTRY.filter((entry) => entry.sortable).map((entry) => [
    entry.key,
    entry.sortField ?? entry.key,
  ]),
);

/**
 * Server sort key for a Contacts column, or `undefined` when the column cannot be sorted.
 * Resolved from the default registry by key so stale stored layouts cannot make a
 * column (or a custom field) look sortable when the server would ignore it.
 */
export function resolveContactColumnSortField(columnKey: string): string | undefined {
  const field = SORTABLE_COLUMN_FIELDS.get(columnKey);
  return field && CONTACT_SORT_FIELDS.has(field) ? field : undefined;
}
