import { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { applyContactsWidgetWorkDrillDown } from "@/lib/contacts/contactsWidgetWorkDrillDown";
import { notify } from "@/lib/notify";
import { useLocalPagination } from "@/hooks/useLocalPagination";
import {
  persistWidgetHasanatDistributionDelete,
  persistWidgetRecordToggle,
} from "@/lib/reports/widgetRecordToggle";
import { useWidgetCollections } from "@/lib/reports/useReportCollections";
import type { ReportCollection } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { getFilteredRecords } from "@/lib/reports/widgetDataUtils";

export function useWidgetDrilldownModal(widget: CustomWidget) {
  const { t } = useTranslation();

  // Contacts widgets have no row dump — redirect to Work with equivalent filters.
  useEffect(() => {
    if (widget.collection === "contacts") {
      applyContactsWidgetWorkDrillDown(widget);
    }
  }, [widget]);

  const requiredCollections = (() => new Set<ReportCollection>([widget.collection, "students"]))();
  const collections = useWidgetCollections({
    requiredCollections,
    enabled: widget.collection !== "contacts",
  });

  const widgetRecords = (() =>
    widget.collection === "contacts" ? [] : getFilteredRecords(widget, collections))();

  const pagination = useLocalPagination({
    items: widgetRecords,
    pageSize: 10,
    filterFn: (record, query) =>
      Object.values(record).some((fieldValue) => String(fieldValue).toLowerCase().includes(query)),
  });

  const studentNameMap = (() => {
    const students = collections.students;
    return new Map(
      students.map((student) => [
        String(student.id),
        String(student.name || (student as { studentName?: string }).studentName || student.id),
      ]),
    );
  })();

  const handleToggleStatus = (recordId: string) => {
    void (async () => {
      try {
        await persistWidgetRecordToggle({
          collectionName: widget.collection,
          recordId,
        });
      } catch {
        notify.error(t("reports.widgets.errorToggleFailed"));
      }
    })();
  };

  const handleDeleteDist = (distId: string) => {
    void (async () => {
      try {
        await persistWidgetHasanatDistributionDelete(distId);
      } catch {
        notify.error(t("reports.widgets.errorDeleteFailed"));
      }
    })();
  };

  return {
    t,
    widget,
    studentNameMap,
    ...pagination,
    handleToggleStatus,
    handleDeleteDist,
  };
}
