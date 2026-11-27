import type React from "react";
import AcademicReport from "./AcademicReport";
import AttendanceReport from "./AttendanceReport";
import ContactReport from "./ContactReport";
import { EnrollmentReportsWrapper } from "./EnrollmentReportsWrapper";
import FacultyReport from "./FacultyReport";
import FinancialReport from "./FinancialReport";
import HasanatReport from "./HasanatReport";
import MessagingReport from "./MessagingReport";
import QuestionBankReport from "./QuestionBankReport";
import SessionReport from "./SessionReport";
import StudentReport from "./StudentReport";
import UsersReport from "./UsersReport";
import type { ReportFilterFields } from "./ReportFilters";
import type { ModuleReportCategory } from "./ModuleReportsToolPanels";
import { FinancialReports, ObligationsSummary } from "../../host/moduleReportAdapters";

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
