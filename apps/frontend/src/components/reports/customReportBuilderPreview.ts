import type { AppTranslationKey } from "@mms/shared";
import type { AggregateFn, DataSource, PreviewRow } from "./customReportBuilderFields";
import { compilePreviewFieldExtractor, toCamelCase } from "./customReportBuilderExtractor";

export { compilePreviewFieldExtractor, toCamelCase };

export interface PreviewCollections {
  contacts: readonly Record<string, unknown>[];
  students: readonly Record<string, unknown>[];
  sessions: readonly Record<string, unknown>[];
  financial: readonly Record<string, unknown>[];
  attendance: readonly Record<string, unknown>[];
  hasanat: readonly Record<string, unknown>[];
  academic: readonly Record<string, unknown>[];
}

export interface BuildPreviewRowsParams {
  source: DataSource;
  selectedFields: readonly string[];
  aggregate: AggregateFn;
  groupBy: string;
  collections: PreviewCollections;
  currencyCode: string;
  translate: (key: AppTranslationKey) => string;
  resolveFieldLabel: (field: string) => string;
}

export function getSourceRows(
  source: DataSource,
  collections: PreviewCollections,
  translate: (key: AppTranslationKey) => string,
): readonly Record<string, unknown>[] {
  if (source === "contacts") return collections.contacts;
  if (source === "students") return collections.students;
  if (source === "sessions") return collections.sessions;
  if (source === "financial") return collections.financial;
  if (source === "attendance") return collections.attendance;
  if (source === "hasanat") return collections.hasanat;
  if (source === "academic") return collections.academic;

  const workloadByFacultyName: Record<
    string,
    { classes: Set<string>; sessions: Set<string>; students: number; specializations: Set<string> }
  > = {};
  collections.sessions.forEach((session) => {
    const classes = session.classes as
      | {
          id: string;
          facultyName?: string;
          enrolled?: number;
          subject?: string;
          specialization?: string;
        }[]
      | undefined;
    if (classes) {
      classes.forEach((sessionClass) => {
        const facultyName = sessionClass.facultyName || translate("reports.builder.unassigned");
        const entry = (workloadByFacultyName[facultyName] ??= {
          classes: new Set(),
          sessions: new Set(),
          students: 0,
          specializations: new Set(),
        });
        entry.classes.add(sessionClass.id);
        entry.sessions.add(String(session.id));
        entry.students += Number(sessionClass.enrolled || 0);
        const spec = sessionClass.specialization || sessionClass.subject;
        if (spec) entry.specializations.add(spec);
      });
    }
  });

  return Object.entries(workloadByFacultyName).map(([facultyName, workload]) => {
    const specList = Array.from(workload.specializations).filter(Boolean);
    const specialization =
      specList.length > 0 ? specList.join(", ") : translate("reports.builder.generalStudies");

    return {
      facultyName,
      classes: workload.classes.size,
      sessions: workload.sessions.size,
      totalStudents: workload.students,
      hoursWeek: workload.classes.size,
      specialization,
    };
  });
}

export function buildFlatPreviewRows({
  source,
  selectedFields,
  collections,
  currencyCode,
  translate,
  resolveFieldLabel,
}: BuildPreviewRowsParams): PreviewRow[] {
  const sourceRows = getSourceRows(source, collections, translate);
  const cellLabels = { yes: translate("common.yes"), no: translate("common.no") };
  const extractors = selectedFields.map((field) =>
    compilePreviewFieldExtractor(field, source, cellLabels, currencyCode, resolveFieldLabel),
  );
  const extractorCount = extractors.length;
  const rowCount = sourceRows.length;
  const rows: PreviewRow[] = new Array(rowCount);

  for (let i = 0; i < rowCount; i++) {
    const sourceRow = sourceRows[i];
    const row: PreviewRow = {};
    for (let j = 0; j < extractorCount; j++) {
      const item = extractors[j];
      row[item.label] = item.extract(sourceRow);
    }
    rows[i] = row;
  }
  return rows;
}

export function applyPreviewAggregates(
  rows: readonly PreviewRow[],
  selectedFields: readonly string[],
  aggregate: AggregateFn,
  groupBy: string,
  resolveFieldLabel: (field: string) => string,
): PreviewRow[] {
  if (!groupBy || aggregate === "None") return [...rows];

  const groupByLabel = resolveFieldLabel(groupBy);
  const groups = new Map<string, PreviewRow[]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const groupValue = String(row[groupByLabel] || "Unspecified");
    let group = groups.get(groupValue);
    if (!group) {
      group = [];
      groups.set(groupValue, group);
    }
    group.push(row);
  }

  const nonGroupFields = selectedFields
    .filter((selectedField) => selectedField !== groupBy)
    .map((selectedField) => resolveFieldLabel(selectedField));

  const result: PreviewRow[] = [];
  for (const [groupName, groupRows] of groups) {
    const summaryRow: PreviewRow = { [groupByLabel]: groupName };
    for (let j = 0; j < nonGroupFields.length; j++) {
      const fieldLabel = nonGroupFields[j];
      if (aggregate === "Count") {
        summaryRow[fieldLabel] = groupRows.length;
        continue;
      }

      const values: number[] = [];
      for (let k = 0; k < groupRows.length; k++) {
        const num = Number(String(groupRows[k][fieldLabel]).replace(/[^0-9.-]/g, ""));
        if (!isNaN(num)) values.push(num);
      }

      if (values.length === 0) {
        summaryRow[fieldLabel] = "—";
      } else {
        switch (aggregate) {
          case "Sum":
            summaryRow[fieldLabel] = values.reduce((sum, value) => sum + value, 0);
            break;
          case "Average":
            summaryRow[fieldLabel] = Math.round(
              values.reduce((sum, value) => sum + value, 0) / values.length,
            );
            break;
          case "Max":
            summaryRow[fieldLabel] = Math.max(...values);
            break;
          case "Min":
            summaryRow[fieldLabel] = Math.min(...values);
            break;
          default:
            summaryRow[fieldLabel] = "—";
        }
      }
    }
    result.push(summaryRow);
  }

  return result;
}

export function buildCustomReportPreviewRows(params: BuildPreviewRowsParams): PreviewRow[] {
  const flatRows = buildFlatPreviewRows(params);
  return applyPreviewAggregates(
    flatRows,
    params.selectedFields,
    params.aggregate,
    params.groupBy,
    params.resolveFieldLabel,
  ).slice(0, 20);
}
