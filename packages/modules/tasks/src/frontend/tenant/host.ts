import type { ComponentType } from "react";

export type TasksHostHook = (...args: any[]) => any;

export interface TasksHostValue {
  usePermissions: TasksHostHook;
  useModulePermissions: TasksHostHook;
  useGenericModuleExport: TasksHostHook;
  BrandingPaletteContext: Record<string, unknown>;
  ModuleReportsTier: ComponentType<any>;
}

let configured: TasksHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureTasksHost(next: TasksHostValue): void {
  configured = next;
}

/** App-bound tasks host. Module UI never imports `@/…`. */
export function getTasksHost(): TasksHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Tasks host is not configured (call configureTasksHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: TasksHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useGenericModuleExport: () => ({ startExport: allow }),
  BrandingPaletteContext: {},
  ModuleReportsTier: T,
};
