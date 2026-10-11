import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type {
  DataTableColumn,
  DataTableFilter,
  DataTableFilterSelection,
  DataTableSearchValue,
} from "./dataTableTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultSearchValue(row: unknown, columnId: string): DataTableSearchValue {
  if (!isRecord(row)) return undefined;
  const value = row[columnId];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string | number => typeof item === "string" || typeof item === "number",
    );
  }
  return undefined;
}

function toSearchText(value: DataTableSearchValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter((item) => item != null).join(" ");
  return String(value);
}

/** Default column registry (visibility/order/width) derived from column definitions. */
export function buildDataTableRegistry<TData>(
  columns: readonly DataTableColumn<TData>[],
): ModuleColumnRegistryEntry[] {
  return columns.map((column, order) => ({
    key: column.id,
    label: column.label,
    enabled: column.fixed ? true : !column.defaultHidden,
    order,
    fixed: column.fixed,
    width: column.width,
  }));
}

/** Columns in user order, filtered to those the registry marks visible. */
export function resolveVisibleColumns<TData>(
  columns: readonly DataTableColumn<TData>[],
  registry: readonly ModuleColumnRegistryEntry[],
): DataTableColumn<TData>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return registry
    .filter((entry) => entry.enabled || entry.fixed)
    .toSorted((a, b) => a.order - b.order)
    .map((entry) => byId.get(entry.key))
    .filter((column): column is DataTableColumn<TData> => column !== undefined);
}

export function countActiveFilters(selection: DataTableFilterSelection): number {
  return Object.values(selection).reduce((total, values) => total + values.length, 0);
}

function matchesFilters<TData>(
  row: TData,
  filters: readonly DataTableFilter<TData>[],
  selection: DataTableFilterSelection,
): boolean {
  return filters.every((filter) => {
    const selected = selection[filter.id];
    if (!selected?.length) return true;
    const raw = filter.getValue(row);
    if (raw == null) return false;
    const values = typeof raw === "string" ? [raw] : raw;
    return values.some((value) => selected.includes(value));
  });
}

/** Tests if haystack matches a search term, supporting wildcards (* and ?). */
export function matchesSearchPattern(haystack: string, term: string): boolean {
  if (!term) return true;
  if (term.includes("*") || term.includes("?")) {
    const regexPattern = term
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    try {
      return new RegExp(regexPattern, "i").test(haystack);
    } catch {
      return haystack.includes(term);
    }
  }
  return haystack.includes(term);
}

/** Search across visible columns with wildcards (case/locale-insensitive) and apply facet filters. */
export function filterDataTableRows<TData>(
  rows: readonly TData[],
  visibleColumns: readonly DataTableColumn<TData>[],
  search: string,
  filters: readonly DataTableFilter<TData>[],
  selection: DataTableFilterSelection,
): TData[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (!matchesFilters(row, filters, selection)) return false;
    if (terms.length === 0) return true;
    const haystack = visibleColumns
      .map((column) =>
        toSearchText(
          column.searchValue ? column.searchValue(row) : defaultSearchValue(row, column.id),
        ),
      )
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => matchesSearchPattern(haystack, term));
  });
}

function compareSearchValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const strA = String(a).trim();
  const strB = String(b).trim();
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
}

/** Sort rows by active sort field and direction. */
export function sortDataTableRows<TData>(
  rows: readonly TData[],
  visibleColumns: readonly DataTableColumn<TData>[],
  sortField?: string,
  sortDir: "asc" | "desc" = "asc",
): TData[] {
  if (!sortField) return [...rows];
  const col = visibleColumns.find((c) => (c.sortField || c.id) === sortField);
  const key = col?.sortField || col?.id || sortField;

  return [...rows].sort((a, b) => {
    const valA = col?.searchValue ? col.searchValue(a) : defaultSearchValue(a, key);
    const valB = col?.searchValue ? col.searchValue(b) : defaultSearchValue(b, key);
    const diff = compareSearchValues(valA, valB);
    return sortDir === "desc" ? -diff : diff;
  });
}
