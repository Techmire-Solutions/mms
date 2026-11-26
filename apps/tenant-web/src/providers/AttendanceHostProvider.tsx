import React from "react";
import { configureAttendanceHost } from "@mms/mod-attendance/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useViewerRole } from "@/tenant/hooks/useViewerRole";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as students from "@/tenant/hooks/collections/students";
import * as examinations from "@/tenant/hooks/collections/examinations";
import * as faculty from "@/tenant/hooks/collections/faculty";
import * as enrollments from "@/tenant/hooks/collections/enrollments";
import * as attendance from "@/tenant/hooks/collections/attendance";
import * as academicCalendarQueries from "@/lib/query/academicCalendarQueries";
import * as facultyAssignment from "@/lib/faculty/facultyAssignment";
import * as sessionsData from "@/lib/data/sessionsData";
import * as studentsData from "@/lib/data/studentsData";
import * as enrollmentData from "@/lib/data/enrollmentData";
import * as attendanceStatusUi from "@mms/mod-attendance/frontend/tenant/lib/attendanceStatusUi";
import * as BrandingPaletteContext from "@/lib/contexts/BrandingPaletteContext";
import { SessionClassSectionSelect } from "@/components/common/SessionClassSectionSelect";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";
import { WorkBatchTable } from "@mms/fe-core/components/WorkBatchTable";
import { WorkTaskToolbar } from "@mms/fe-core/components/WorkTaskToolbar";

/** Binds the app's RBAC, config, collections, calendar and overlays into the attendance module host. */
export function AttendanceHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureAttendanceHost({
    usePermissions,
    useModulePermissions,
    useViewerRole,
    useAttendanceConfig,
    useAcademicTerms,
    useWorkspaceToday,
    useCurrency,
    useFinanceCurrency,
    useModuleSettingsEditor,
    useGlobalSettings,
    useWorkDrillDownListener,
    useGenericModuleExport,
    useMessageComposerState,
    sessionsCollection: sessions as unknown as Record<string, (...args: unknown[]) => unknown>,
    studentsCollection: students as unknown as Record<string, (...args: unknown[]) => unknown>,
    examinationsCollection: examinations as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >,
    facultyCollection: faculty as unknown as Record<string, (...args: unknown[]) => unknown>,
    enrollmentsCollection: enrollments as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >,
    attendanceCollection: attendance as unknown as Record<string, (...args: unknown[]) => unknown>,
    academicCalendarQueries: academicCalendarQueries as unknown as Record<string, unknown>,
    facultyAssignment: facultyAssignment as unknown as Record<string, unknown>,
    sessionsData: sessionsData as unknown as Record<string, unknown>,
    studentsData: studentsData as unknown as Record<string, unknown>,
    enrollmentData: enrollmentData as unknown as Record<string, unknown>,
    attendanceStatusUi: attendanceStatusUi as unknown as Record<string, unknown>,
    BrandingPaletteContext: BrandingPaletteContext as unknown as Record<string, unknown>,
    SessionClassSectionSelect:
      SessionClassSectionSelect as unknown as unknown as React.ComponentType<Record<string, never>>,
    ModuleReportsTier: ModuleReportsTier as unknown as unknown as React.ComponentType<
      Record<string, never>
    >,
    TenantMessageComposer: TenantMessageComposer as unknown as unknown as React.ComponentType<
      Record<string, never>
    >,
    WorkBatchTable: WorkBatchTable as unknown as unknown as React.ComponentType<
      Record<string, never>
    >,
    WorkTaskToolbar: WorkTaskToolbar as unknown as unknown as React.ComponentType<
      Record<string, never>
    >,
  });
  return <>{children}</>;
}
