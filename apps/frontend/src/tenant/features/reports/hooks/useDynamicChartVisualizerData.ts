import type { ContactsWidgetOperation, StudentsWidgetOperation } from "@mms/shared";
import { useReportCollectionRows } from "@/lib/reports/useReportCollections";
import { useContactsWidgetAggregates } from "@/tenant/hooks/collections/contacts";
import { useStudentsWidgetAggregates } from "@/tenant/hooks/collections/students";
import type {
  AggregatedItem,
  ChartOperation,
  FilterRule,
} from "@/components/reports/dynamicChartVisualizerTypes";
import {
  aggregateVisualizerRows,
  sortAndCapAggregatedItems,
} from "@/components/reports/dynamicChartVisualizerHelpers";

const CONTACTS_VISUALIZER_QUERY_ID = "contacts-visualizer";
const STUDENTS_VISUALIZER_QUERY_ID = "students-visualizer";

function toContactsWidgetOperation(operation: ChartOperation): ContactsWidgetOperation {
  if (operation === "sum" || operation === "avg") return operation;
  return "count";
}

function toStudentsWidgetOperation(operation: ChartOperation): StudentsWidgetOperation {
  if (operation === "sum" || operation === "avg") return operation;
  return "count";
}

export interface UseDynamicChartVisualizerDataOptions {
  collectionKey: string;
  operation: ChartOperation;
  targetField: string;
  xAxisField: string;
  filters: FilterRule[];
}

export function useDynamicChartVisualizerData({
  collectionKey,
  operation,
  targetField,
  xAxisField,
  filters,
}: UseDynamicChartVisualizerDataOptions): AggregatedItem[] {
  const isContacts = collectionKey === "contacts";
  const isStudents = collectionKey === "students";
  const { rows: collectionRows, denominations } = useReportCollectionRows(
    isContacts || isStudents ? "" : collectionKey,
  );

  const contactsVisualizerWidgets = (() => {
    if (!isContacts) return [];
    return [
      {
        id: CONTACTS_VISUALIZER_QUERY_ID,
        collection: "contacts" as const,
        operation: toContactsWidgetOperation(operation),
        targetField: targetField || undefined,
        xAxisField,
        filters: filters
          .filter((rule) => rule.field && rule.value)
          .map((rule) => ({
            field: rule.field,
            operator: rule.operator,
            value: rule.value,
          })),
        chartLimit: 20,
      },
    ];
  })();

  const studentsVisualizerWidgets = (() => {
    if (!isStudents) return [];
    return [
      {
        id: STUDENTS_VISUALIZER_QUERY_ID,
        collection: "students" as const,
        operation: toStudentsWidgetOperation(operation),
        targetField: targetField || undefined,
        xAxisField,
        filters: filters
          .filter((rule) => rule.field && rule.value)
          .map((rule) => ({
            field: rule.field,
            operator: rule.operator as "equals" | "contains" | "gt" | "lt" | undefined,
            value: rule.value,
          })),
        chartLimit: 20,
      },
    ];
  })();

  const { data: contactsAggregates } = useContactsWidgetAggregates(contactsVisualizerWidgets, {
    enabled: isContacts,
  });

  const { data: studentsAggregates } = useStudentsWidgetAggregates(studentsVisualizerWidgets, {
    enabled: isStudents,
  });

  if (isContacts) {
    const chartData = contactsAggregates?.[CONTACTS_VISUALIZER_QUERY_ID]?.chartData ?? [];
    const items: AggregatedItem[] = chartData.map((row) => ({
      name: row.name,
      value: row.value,
      count: row.value,
    }));
    return sortAndCapAggregatedItems(items, xAxisField, operation);
  }

  if (isStudents) {
    const chartData = studentsAggregates?.[STUDENTS_VISUALIZER_QUERY_ID]?.chartData ?? [];
    const items: AggregatedItem[] = chartData.map((row) => ({
      name: row.name,
      value: row.value,
      count: row.value,
    }));
    return sortAndCapAggregatedItems(items, xAxisField, operation);
  }

  return aggregateVisualizerRows({
    collectionKey,
    collectionRows,
    denominations,
    filters,
    xAxisField,
    operation,
    targetField,
  });
}
