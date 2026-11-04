import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { scopedStorageKey } from "@/lib/dbStorageCore";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { invalidateFacultyQueries } from "@/tenant/features/faculty/hooks/invalidateFacultyQueries";

const FACULTY_EMPLOYEE_ID_MIGRATION_KEY = "faculty_employee_id_migration_v1";

/**
 * Workspace-scoped gate: the backfill must run once per tenant, not once per
 * browser. A global key silently skipped every workspace after the first one,
 * leaving their legacy faculty rows without an employee id.
 */
function employeeIdMigrationStorageKey(): string {
  return scopedStorageKey(FACULTY_EMPLOYEE_ID_MIGRATION_KEY);
}

function employeeIdMigrationAlreadyDone(): boolean {
  try {
    return localStorage.getItem(employeeIdMigrationStorageKey()) === "1";
  } catch {
    return false;
  }
}

function markEmployeeIdMigrationDone(): void {
  try {
    localStorage.setItem(employeeIdMigrationStorageKey(), "1");
  } catch {
    // non-fatal: the one-shot gate is best-effort dedupe only
  }
}

/**
 * One-shot employee-id backfill for legacy faculty rows missing an id.
 * Runs once per workspace (tenant-scoped localStorage gate) when a Setup writer
 * opens the Faculties tab — matches BE `setupWrite`. The POST goes through a `useMutation`
 * so the outcome surfaces via `notify.*` + `t()` instead of silent console warnings.
 */
export function useEmployeeIdMigration(activeTab: string, canEditSetup: boolean): void {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [needsMigrationScan, setNeedsMigrationScan] = useState(
    () => !employeeIdMigrationAlreadyDone(),
  );
  const migrationAppliedRef = useRef(false);

  const { mutate } = useMutation({
    mutationFn: async () => {
      const res = await apiContract.faculty.migrateEmployeeIds({ body: {} });
      // A non-2xx must not mark the gate done — that silently cancelled the
      // backfill for this workspace forever.
      assertContractOk(res, "Failed to backfill employee IDs");
      return { updated: (res.body as { updated?: number } | null)?.updated ?? 0 };
    },
    onSuccess: (result: { updated: number }) => {
      invalidateFacultyQueries(queryClient);
      markEmployeeIdMigrationDone();
      setNeedsMigrationScan(false);
      if (result.updated > 0) {
        notify.success(t("faculty.employeeIdMigrationCompleted"), {
          description: t("faculty.employeeIdMigrationUpdated", { count: result.updated }),
        });
      }
    },
    onError: () => {
      migrationAppliedRef.current = false;
      notify.error(t("faculty.employeeIdMigrationFailed"));
    },
  });

  useEffect(() => {
    if (!canEditSetup || !needsMigrationScan || activeTab !== "faculties") return;
    if (migrationAppliedRef.current) return;
    migrationAppliedRef.current = true;
    mutate();
  }, [activeTab, canEditSetup, needsMigrationScan, mutate]);
}
