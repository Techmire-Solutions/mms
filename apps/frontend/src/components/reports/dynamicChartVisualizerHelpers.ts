import { getDenominationPoints } from "@mms/shared";
import type { AggregatedItem, ChartOperation, FilterRule } from "./dynamicChartVisualizerTypes";

export function isDateDimensionField(fieldName: string): boolean {
  return /date|time|created|updated|issued|registered/i.test(fieldName);
}

export function matchesFilterRule(row: Record<string, unknown>, rule: FilterRule): boolean {
  if (!rule.field || !rule.value) return true;
  const fieldValue = row[rule.field];
  if (fieldValue === undefined || fieldValue === null) return false;

  const stringValue = String(fieldValue).toLowerCase();
  const ruleValue = String(rule.value).toLowerCase();

  switch (rule.operator) {
    case "equals":
      return stringValue === ruleValue;
    case "contains":
      return stringValue.includes(ruleValue);
    case "startsWith":
      return stringValue.startsWith(ruleValue);
    case "gt":
      return Number(fieldValue) > Number(rule.value);
    case "lt":
      return Number(fieldValue) < Number(rule.value);
    default:
      return true;
  }
}

export function sortAndCapAggregatedItems(
  aggregatedRows: AggregatedItem[],
  xAxisField: string,
  operation: ChartOperation,
): AggregatedItem[] {
  if (isDateDimensionField(xAxisField)) {
    const sortedRows = [...aggregatedRows].sort((firstItem, secondItem) => {
      const timeA = new Date(firstItem.name).getTime();
      const timeB = new Date(secondItem.name).getTime();
      if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
        return firstItem.name.localeCompare(secondItem.name);
      }
      return timeA - timeB;
    });
    return sortedRows.length > 20 ? sortedRows.slice(-20) : sortedRows;
  }

  const sortedRows = [...aggregatedRows].sort(
    (firstItem, secondItem) => secondItem.value - firstItem.value,
  );
  if (sortedRows.length <= 10) return sortedRows;

  const topRows = sortedRows.slice(0, 9);
  const remainingRows = sortedRows.slice(9);
  const othersCount = remainingRows.reduce((sum, remainingRow) => sum + remainingRow.count, 0);

  let finalOthersValue = remainingRows.reduce((sum, remainingRow) => sum + remainingRow.value, 0);
  if (operation === "avg") {
    const totalCount = remainingRows.reduce((sum, remainingRow) => sum + remainingRow.count, 0);
    if (totalCount > 0) {
      const weightedSum = remainingRows.reduce(
        (sum, remainingRow) => sum + remainingRow.value * remainingRow.count,
        0,
      );
      finalOthersValue = Math.round(weightedSum / totalCount);
    }
  } else if (operation === "min") {
    finalOthersValue = Math.min(...remainingRows.map((remainingRow) => remainingRow.value));
  } else if (operation === "max") {
    finalOthersValue = Math.max(...remainingRows.map((remainingRow) => remainingRow.value));
  }

  return [
    ...topRows,
    {
      name: `Others (${remainingRows.length} fields)`,
      value: finalOthersValue,
      count: othersCount,
    },
  ];
}

export function aggregateVisualizerRows(options: {
  collectionKey: string;
  collectionRows: Record<string, unknown>[];
  denominations: Array<{ id: string; points: number }> | null | undefined;
  filters: FilterRule[];
  xAxisField: string;
  operation: ChartOperation;
  targetField: string;
}): AggregatedItem[] {
  const {
    collectionKey,
    collectionRows,
    denominations,
    filters,
    xAxisField,
    operation,
    targetField,
  } = options;

  const filteredRows = collectionRows.filter((collectionRow) => {
    if (!collectionRow) return false;
    return filters.every((rule) => matchesFilterRule(collectionRow, rule));
  });

  const groups: Record<string, Record<string, unknown>[]> = {};
  filteredRows.forEach((filteredRow) => {
    const xAxisValue = filteredRow[xAxisField];
    const groupKey =
      xAxisValue === undefined || xAxisValue === null || xAxisValue === ""
        ? "Unknown / Null"
        : String(xAxisValue);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(filteredRow);
  });

  const aggregatedRows = Object.entries(groups).map(([name, groupItems]) => {
    let finalValue = 0;
    const count = groupItems.length;

    if (operation === "count") {
      finalValue = count;
    } else {
      const targetMetricField = targetField || "";
      const values: number[] = [];

      groupItems.forEach((groupItem) => {
        if (collectionKey === "hasanat_distributions" && targetMetricField === "points") {
          const points = getDenominationPoints(
            groupItem.denominationId as string,
            groupItem.denominationName as string,
            denominations,
          );
          values.push(Number(groupItem.quantity || 1) * points);
        } else {
          const numericValue = Number(groupItem[targetMetricField]);
          if (!isNaN(numericValue)) {
            values.push(numericValue);
          }
        }
      });

      if (values.length > 0) {
        switch (operation) {
          case "sum":
            finalValue = values.reduce((sum, value) => sum + value, 0);
            break;
          case "avg":
            finalValue = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
            break;
          case "min":
            finalValue = Math.min(...values);
            break;
          case "max":
            finalValue = Math.max(...values);
            break;
          default:
            finalValue = 0;
        }
      }
    }

    return { name, value: finalValue, count };
  });

  return sortAndCapAggregatedItems(aggregatedRows, xAxisField, operation);
}

export function resolveWidgetPinColor(activePalette: string): string {
  if (activePalette === "emeraldForest" || activePalette.startsWith("tol")) return "emerald";
  if (activePalette === "oceanBreeze" || activePalette === "accessibleColorblind") return "blue";
  if (activePalette === "cosmicViolet") return "violet";
  return "amber";
}

export function getPdfPageDimensions(
  pdfFormat: string,
  pdfOrientation: "p" | "l",
): { formatWidth: number; formatHeight: number } {
  const SIZES: Record<string, [number, number]> = {
    a3: [297, 420],
    legal: [215.9, 355.6],
    letter: [215.9, 279.4],
  };
  const [w, h] = SIZES[pdfFormat] ?? [210, 297];
  return pdfOrientation === "l"
    ? { formatWidth: h, formatHeight: w }
    : { formatWidth: w, formatHeight: h };
}
