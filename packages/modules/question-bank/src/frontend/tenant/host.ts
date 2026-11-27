import type { ComponentType } from "react";
import { questionBankEntityDescriptor } from "./lib/questionBankDescriptor.js";

export type QuestionBankHostHook = (...args: any[]) => any;

export interface QuestionBankHostValue {
  useStaticEntityDescriptor: QuestionBankHostHook;
  useGenericModuleExport: QuestionBankHostHook;
  useSessionsCollection: QuestionBankHostHook;
  useModuleSettingsEditor: QuestionBankHostHook;
  useModulePermissions: QuestionBankHostHook;
  standardModulesConfigRegistry: Record<string, unknown>;
  WorkBatchTable: ComponentType<any>;
  WorkTaskToolbar: ComponentType<any>;
  SessionClassSectionSelect: ComponentType<any>;
  sessionIdForClass: QuestionBankHostHook;
  ReportChartCard: ComponentType<any>;
  ReportDataGridContainer: ComponentType<any>;
}

let configured: QuestionBankHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureQuestionBankHost(next: QuestionBankHostValue): void {
  configured = next;
}

/** App-bound question-bank host. Module UI never imports `@/…`. */
export function getQuestionBankHost(): QuestionBankHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Question bank host is not configured (call configureQuestionBankHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: QuestionBankHostValue = {
  useStaticEntityDescriptor: () => questionBankEntityDescriptor as any,
  useGenericModuleExport: () => ({ startExport: allow }),
  useSessionsCollection: () => ({ data: [], isLoading: false }),
  useModuleSettingsEditor: () => ({ draft: {}, save: allow, discardDrafts: allow }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  standardModulesConfigRegistry: {
    "question-bank": { defaultSettings: {}, defaultFieldDefs: [] },
  },
  WorkBatchTable: T,
  WorkTaskToolbar: T,
  SessionClassSectionSelect: T,
  sessionIdForClass: (done) => done,
  ReportChartCard: T,
  ReportDataGridContainer: ({ children }: { children?: unknown }) => children as never,
};
