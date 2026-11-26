import type { ComponentType } from "react";

export type AttendanceHostHook = (...args: any[]) => any;

export interface AttendanceHostValue {
  usePermissions: AttendanceHostHook;
  useModulePermissions: AttendanceHostHook;
  useViewerRole: AttendanceHostHook;
  useAttendanceConfig: AttendanceHostHook;
  useAcademicTerms: AttendanceHostHook;
  useWorkspaceToday: AttendanceHostHook;
  useCurrency: AttendanceHostHook;
  useFinanceCurrency: AttendanceHostHook;
  useModuleSettingsEditor: AttendanceHostHook;
  useGlobalSettings: AttendanceHostHook;
  useWorkDrillDownListener: AttendanceHostHook;
  useGenericModuleExport: AttendanceHostHook;
  useMessageComposerState: AttendanceHostHook;
  sessionsCollection: Record<string, AttendanceHostHook>;
  studentsCollection: Record<string, AttendanceHostHook>;
  examinationsCollection: Record<string, AttendanceHostHook>;
  facultyCollection: Record<string, AttendanceHostHook>;
  enrollmentsCollection: Record<string, AttendanceHostHook>;
  attendanceCollection: Record<string, AttendanceHostHook>;
  academicCalendarQueries: Record<string, unknown>;
  facultyAssignment: Record<string, unknown>;
  sessionsData: Record<string, unknown>;
  studentsData: Record<string, unknown>;
  enrollmentData: Record<string, unknown>;
  attendanceStatusUi: Record<string, unknown>;
  BrandingPaletteContext: Record<string, unknown>;
  SessionClassSectionSelect: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
  ReportChartCard?: ComponentType<any>;
  KPISummary?: ComponentType<any>;
  ModuleReports?: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
  WorkBatchTable: ComponentType<any>;
  WorkTaskToolbar: ComponentType<any>;
}

let configured: AttendanceHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureAttendanceHost(next: AttendanceHostValue): void {
  configured = next;
}

/** App-bound attendance host. Module UI never imports `@/…`. */
export function getAttendanceHost(): AttendanceHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Attendance host is not configured (call configureAttendanceHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: AttendanceHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useViewerRole: () => ({ role: "admin" }),
  useAttendanceConfig: () => ({
    statuses: [
      { id: "present", label: "Present" },
      { id: "absent", label: "Absent" },
      { id: "late", label: "Late" },
      { id: "excused", label: "Excused" },
      { id: "half_day", label: "Half day" },
    ],
  }),
  useAcademicTerms: () => ({ terms: [] }),
  useWorkspaceToday: () => "2026-01-01",
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useGlobalSettings: () => ({}),
  useWorkDrillDownListener: () => undefined,
  useGenericModuleExport: () => ({ startExport: allow }),
  useMessageComposerState: () => ({}),
  sessionsCollection: {},
  studentsCollection: {},
  examinationsCollection: {},
  facultyCollection: {},
  enrollmentsCollection: {},
  attendanceCollection: {},
  academicCalendarQueries: {},
  facultyAssignment: {
    activeFacultyForAssignment: (faculty: unknown) => (Array.isArray(faculty) ? faculty : []),
    facultyNameById: () => undefined,
    resolveClassFacultyId: () => undefined,
    resolveClassFacultyName: () => undefined,
    assignClassFaculty: () => undefined,
  },
  sessionsData: {},
  studentsData: {},
  enrollmentData: {},
  attendanceStatusUi: {},
  BrandingPaletteContext: {},
  SessionClassSectionSelect: T,
  ModuleReportsTier: T,
  TenantMessageComposer: T,
  WorkBatchTable: T,
  WorkTaskToolbar: T,
};
