import { useState, useCallback } from "react";
import { useContactsContractList } from "../../host/collections";
import { useStudentsContractList } from "../../host/collections";
import { useSessionsCollection } from "../../host/collections";
import { useFinanceInvoicesPaginated } from "../../host/collections";
import { useAttendanceRecordsCollection } from "../../host/collections";
import { useHasanatDistributionsCollection } from "../../host/collections";
import { useExaminationsResultsCollection } from "../../host/collections";
import { useTranslation } from "@mms/fe-core/i18n";
import { usePermissions } from "../../host/usePermissions";
import { useFinanceCurrency } from "../../host/useCurrency";
import { CONTACTS_MODULE_MANIFEST, STUDENTS_MODULE_MANIFEST } from "@mms/contracts";
import {
  buildContactsCustomReportFieldCatalog,
  buildCustomReportFieldCatalog,
  getInitialDataSource,
  getInitialSelectedFields,
  resolveCustomReportFieldLabel,
  type AggregateFn,
  type DataSource,
  type PreviewRow,
} from "../../components/customReportBuilderFields";
import { buildCustomReportPreviewRows } from "../../components/customReportBuilderPreview";

export function useCustomReportBuilderState(initialSource?: string) {
  const { t } = useTranslation();
  const { role: viewerRole } = usePermissions();
  const { activeCurrency } = useFinanceCurrency();

  const [source, setSource] = useState<DataSource>(() => getInitialDataSource(initialSource));
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    getInitialSelectedFields(initialSource),
  );
  const [aggregate, setAggregate] = useState<AggregateFn>("None");
  const [groupBy, setGroupBy] = useState<string>("");
  const [orientation, setOrientation] = useState<"p" | "l">("p");
  const [pageSize, setPageSize] = useState<string>("a4");
  const [reportName, setReportName] = useState<string>(() => t("reports.builder.defaultName"));

  const { data: contactsPreviewPage } = useContactsContractList(
    {
      page: 1,
      limit: CONTACTS_MODULE_MANIFEST.defaultPageSize,
    },
    source === "contacts",
  );
  const { data: studentsPreviewPage } = useStudentsContractList(
    {
      page: 1,
      limit: STUDENTS_MODULE_MANIFEST.defaultPageSize,
    },
    source === "students",
  );
  const contactsColl = (() =>
    (contactsPreviewPage?.body?.contacts ?? []).map((row: Record<string, unknown>) => ({
      ...row,
    })))();
  const studentsColl = (() =>
    (studentsPreviewPage?.body?.students ?? []).map((row: Record<string, unknown>) => ({
      ...row,
    })))();
  const sessionsData = useSessionsCollection({ enabled: source === "sessions" });
  const sessionsColl = (() => (sessionsData ?? []).map((row: any) => ({ ...row })))();

  const financialResult = useFinanceInvoicesPaginated(
    { page: 1, limit: 50 },
    { enabled: source === "financial" },
  );
  const financialData = financialResult.data?.invoices;
  const financialColl = (() => (financialData ?? []).map((row: any) => ({ ...row })))();

  const attendanceData = useAttendanceRecordsCollection({ enabled: source === "attendance" });
  const attendanceColl = (() => (attendanceData ?? []).map((row: any) => ({ ...row })))();

  const hasanatData = useHasanatDistributionsCollection({ enabled: source === "hasanat" });
  const hasanatColl = (() => (hasanatData ?? []).map((row: any) => ({ ...row })))();

  const academicData = useExaminationsResultsCollection({ enabled: source === "academic" });
  const academicColl = (() => (academicData ?? []).map((row: any) => ({ ...row })))();

  const resolveFieldLabel = useCallback(
    (field: string): string =>
      resolveCustomReportFieldLabel(source, field, {}, (key: any) => t(key)),
    [source, t],
  );

  const contactsFieldCatalog = (() => {
    if (source !== "contacts") return [];
    return buildContactsCustomReportFieldCatalog({}, [], viewerRole);
  })();

  const available = (() =>
    buildCustomReportFieldCatalog(source, selectedFields, contactsFieldCatalog))();

  // Adjust state during render: a group-by field that is no longer selected must be cleared.
  if (groupBy && !selectedFields.includes(groupBy)) {
    setGroupBy("");
  }

  const previewData: PreviewRow[] =
    selectedFields.length === 0
      ? []
      : buildCustomReportPreviewRows({
          source,
          selectedFields,
          aggregate,
          groupBy,
          collections: {
            contacts: contactsColl,
            students: studentsColl,
            sessions: sessionsColl,
            financial: financialColl,
            attendance: attendanceColl,
            hasanat: hasanatColl,
            academic: academicColl,
          },
          currencyCode: activeCurrency.code,
          translate: (key: any) => t(key),
          resolveFieldLabel,
        });

  const addField = (field: string): void => {
    setSelectedFields((currentFields: any) => [...currentFields, field]);
  };

  const removeField = (field: string): void => {
    setSelectedFields((currentFields: any) =>
      currentFields.filter((candidate: any) => candidate !== field),
    );
  };

  const moveUp = (index: number): void => {
    setSelectedFields((currentFields: any) => {
      const nextFields = [...currentFields];
      [nextFields[index - 1], nextFields[index]] = [nextFields[index], nextFields[index - 1]];
      return nextFields;
    });
  };

  const moveDown = (index: number): void => {
    setSelectedFields((currentFields: any) => {
      const nextFields = [...currentFields];
      [nextFields[index + 1], nextFields[index]] = [nextFields[index], nextFields[index + 1]];
      return nextFields;
    });
  };

  return {
    reportName,
    setReportName,
    source,
    setSource,
    selectedFields,
    setSelectedFields,
    aggregate,
    setAggregate,
    groupBy,
    setGroupBy,
    orientation,
    setOrientation,
    pageSize,
    setPageSize,
    previewData,
    available,
    resolveFieldLabel,
    addField,
    removeField,
    moveUp,
    moveDown,
  };
}
