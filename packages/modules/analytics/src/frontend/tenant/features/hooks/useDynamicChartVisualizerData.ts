import type { ContactsWidgetOperation, StudentsWidgetOperation } from "@mms/contracts";
import { useReportCollectionRows } from "../../lib/useReportCollections";
import { useContactsWidgetAggregates } from "../../host/collections";
import { useStudentsWidgetAggregates } from "../../host/collections";
import type {
  AggregatedItem,
  ChartOperation,
  FilterRule,
} from "../../components/dynamicChartVisualizerTypes";
import {
  aggregateVisualizerRows,
  sortAndCapAggregatedItems,
} from "../../components/dynamicChartVisualizerHelpers";

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
          .filter((rule: any) => rule.field && rule.value)
          .map((rule: any) => ({
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
          .filter((rule: any) => rule.field && rule.value)
          .map((rule: any) => ({
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
    const items: AggregatedItem[] = chartData.map((row: any) => ({
      name: row.name,
      value: row.value,
      count: row.value,
    }));
    return sortAndCapAggregatedItems(items, xAxisField, operation);
  }

  if (isStudents) {
    const chartData = studentsAggregates?.[STUDENTS_VISUALIZER_QUERY_ID]?.chartData ?? [];
    const items: AggregatedItem[] = chartData.map((row: any) => ({
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
