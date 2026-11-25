/**
 * Faculty directory neutral-filter values.
 *
 * The Filters menu renders a synthetic "All …" option whose radio value is
 * `all`, while the query/state model uses the empty string for "no filter".
 * Keeping the translation in one place stops a raw `all` reaching the server,
 * where it is treated as an equality filter and empties the directory.
 */

export const FACULTY_FILTER_ALL = "all";

/** Menu option value → filter state (`all` means "no filter"). */
export function normalizeFacultyFilterValue(value: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed === FACULTY_FILTER_ALL ? "" : trimmed;
}

/** Filter state → the menu option value that should appear selected. */
export function facultyFilterMenuValue(value: string): string {
  return (value ?? "").trim() ? value : FACULTY_FILTER_ALL;
}
