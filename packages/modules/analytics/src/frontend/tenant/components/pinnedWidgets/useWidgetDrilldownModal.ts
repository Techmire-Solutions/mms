import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { applyContactsWidgetWorkDrillDown } from "../../host/reportLibs";
import { notify } from "@mms/fe-core/notify";
import { useLocalPagination } from "@mms/fe-core/hooks/useLocalPagination";
import {
  persistWidgetHasanatDistributionDelete,
  persistWidgetRecordToggle,
} from "../../lib/widgetRecordToggle";
import { useWidgetCollections } from "../../lib/useReportCollections";
import type { ReportCollection } from "../../lib/reportMetadata";
import type { CustomWidget } from "../../lib/pinnedWidgetTypes";
import { getFilteredRecords } from "../../lib/widgetDataUtils";

export function useWidgetDrilldownModal(widget: CustomWidget) {
  const { t } = useTranslation();

  // Contacts widgets have no row dump — redirect to Work with equivalent filters.
  useEffect(() => {
    if (widget.collection === "contacts") {
      applyContactsWidgetWorkDrillDown(widget);
    }
  }, [widget]);

  const requiredCollections = useMemo(
    () => new Set<ReportCollection>([widget.collection, "students"]),
    [widget.collection],
  );
  const collections = useWidgetCollections({
    requiredCollections,
    enabled: widget.collection !== "contacts",
  });

  const widgetRecords = useMemo(
    () => (widget.collection === "contacts" ? [] : getFilteredRecords(widget, collections)),
    [widget, collections],
  );

  const filterFn = useCallback(
    (record: Record<string, unknown>, query: string) =>
      Object.values(record).some((fieldValue: any) =>
        String(fieldValue).toLowerCase().includes(query),
      ),
    [],
  );

  const pagination = useLocalPagination({
    items: widgetRecords,
    pageSize: 10,
    filterFn,
  });

  const studentNameMap = (() => {
    const students = collections.students;
    return new Map(
      students.map((student: any) => [
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
