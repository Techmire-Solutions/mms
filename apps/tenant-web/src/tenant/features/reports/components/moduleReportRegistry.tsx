import type React from "react";
import AcademicReport from "@/tenant/features/reports/components/AcademicReport";
import AttendanceReport from "@/tenant/features/reports/components/AttendanceReport";
import ContactReport from "@/tenant/features/reports/components/ContactReport";
import { EnrollmentReportsWrapper } from "@/tenant/features/reports/components/EnrollmentReportsWrapper";
import FacultyReport from "@/tenant/features/reports/components/FacultyReport";
import FinancialReport from "@/tenant/features/reports/components/FinancialReport";
import HasanatReport from "@/tenant/features/reports/components/HasanatReport";
import MessagingReport from "@/tenant/features/reports/components/MessagingReport";
import QuestionBankReport from "@/tenant/features/reports/components/QuestionBankReport";
import SessionReport from "@/tenant/features/reports/components/SessionReport";
import StudentReport from "@/tenant/features/reports/components/StudentReport";
import UsersReport from "@/tenant/features/reports/components/UsersReport";
import type { ReportFilterFields } from "@/tenant/features/reports/components/ReportFilters";
import type { ModuleReportCategory } from "@/tenant/features/reports/components/ModuleReportsToolPanels";
import {
  FinancialReports,
  ObligationsSummary,
} from "@/tenant/components/reports/moduleReportAdapters";

export interface ModuleReportRenderContext {
  filters: ReportFilterFields;
  onEditVisual: (config: unknown) => void;
}

export interface ModuleReportEntry {
  /** Body rendered on the reports dashboard tab. */
  render: (ctx: ModuleReportRenderContext) => React.ReactNode;
  /** Category owns its own filter UI (suppresses the shared `ReportFilters`). */
  hasInternalFilters: boolean;
}

const filterable = (
  render: (ctx: ModuleReportRenderContext) => React.ReactNode,
): ModuleReportEntry => ({ render, hasInternalFilters: false });

const selfFiltered = (
  render: (ctx: ModuleReportRenderContext) => React.ReactNode,
): ModuleReportEntry => ({ render, hasInternalFilters: true });

/**
 * Single source of truth for per-category report rendering — replaces the
 * `switch (category)` in `ModuleReports` and the local internal-filter set.
 * Exhaustive over `ModuleReportCategory`.
 */
export const MODULE_REPORT_REGISTRY: Record<ModuleReportCategory, ModuleReportEntry> = {
  students: filterable(({ filters, onEditVisual }) => (
    <StudentReport filters={filters} onEditVisual={onEditVisual} />
  )),
  faculty: filterable(({ filters, onEditVisual }) => (
    <FacultyReport filters={filters} onEditVisual={onEditVisual} />
  )),
  contacts: selfFiltered(({ onEditVisual }) => <ContactReport onEditVisual={onEditVisual} />),
  attendance: filterable(({ filters, onEditVisual }) => (
    <AttendanceReport filters={filters} onEditVisual={onEditVisual} />
  )),
  finance: filterable(({ filters, onEditVisual }) => (
    <FinancialReport filters={filters} onEditVisual={onEditVisual} />
  )),
  financial: filterable(({ filters, onEditVisual }) => (
    <FinancialReport filters={filters} onEditVisual={onEditVisual} />
  )),
  accounting: selfFiltered(() => <FinancialReports />),
  enrollments: filterable(({ filters }) => <EnrollmentReportsWrapper filters={filters} />),
  obligations: selfFiltered(() => <ObligationsSummary />),
  messaging: selfFiltered(() => <MessagingReport />),
  users: selfFiltered(() => <UsersReport />),
  examinations: filterable(({ filters, onEditVisual }) => (
    <AcademicReport filters={filters} onEditVisual={onEditVisual} />
  )),
  questionBank: filterable(({ filters, onEditVisual }) => (
    <QuestionBankReport filters={filters} onEditVisual={onEditVisual} />
  )),
  hasanat: filterable(({ filters, onEditVisual }) => (
    <HasanatReport filters={filters} onEditVisual={onEditVisual} />
  )),
  sessions: filterable(({ filters, onEditVisual }) => (
    <SessionReport filters={filters} onEditVisual={onEditVisual} />
  )),
  saved: filterable(() => null),
};
