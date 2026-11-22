import { useMemo } from "react";
import { ATTENDANCE_MODULE_MANIFEST, buildAttendanceWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useAttendanceColumnLayout() {
  const { t } = useTranslation();

  // Stable registry identity keeps the column layout (and the DataTable's memoized row props)
  // stable across unrelated re-renders — build it once per locale, not once per render.
  const tenantRegistry = useMemo(
    () =>
      buildAttendanceWorkColumnRegistry({
        date: t("attendance.columns.date"),
        class: t("attendance.columns.class"),
        session: t("attendance.columns.session"),
        student: t("attendance.columns.student"),
        status: t("attendance.columns.status"),
        timeIn: t("attendance.columns.timeIn"),
        timeOut: t("attendance.columns.timeOut"),
        notes: t("attendance.columns.notes"),
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    tenantRegistry,
    apiPath: ATTENDANCE_MODULE_MANIFEST.restBasePath,
    translationPrefix: "attendance.columns",
  });
}
