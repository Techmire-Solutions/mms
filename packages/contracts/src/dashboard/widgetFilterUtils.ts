/** Evaluates a dashboard widget's filter condition against a record. */
export function matchesWidgetFilter(
  item: Record<string, unknown> | null | undefined,
  filterField?: string,
  filterOperator?: string,
  filterValue?: string,
): boolean {
  if (!item || !filterField) return true;
  const fieldValue = item[filterField];
  if (fieldValue === undefined || fieldValue === null) return false;

  const normalizedFieldValue = String(fieldValue).toLowerCase();
  const normalizedTargetValue = String(filterValue ?? "").toLowerCase();

  switch (filterOperator) {
    case "equals":
      return normalizedFieldValue === normalizedTargetValue;
    case "contains":
      return normalizedFieldValue.includes(normalizedTargetValue);
    case "gt":
      return Number(fieldValue) > Number(filterValue);
    case "lt":
      return Number(fieldValue) < Number(filterValue);
    default:
      return true;
  }
}
