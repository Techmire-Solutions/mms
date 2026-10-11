import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { invalidateFacultyQueries } from "@/tenant/features/faculty/hooks/invalidateFacultyQueries";

const FACULTY_EMPLOYEE_ID_MIGRATION_KEY = "mms_faculty_employee_id_migration_v1";

function employeeIdMigrationAlreadyDone(): boolean {
  try {
    return localStorage.getItem(FACULTY_EMPLOYEE_ID_MIGRATION_KEY) === "1";
  } catch {
    return false;
  }
}

function markEmployeeIdMigrationDone(): void {
  try {
    localStorage.setItem(FACULTY_EMPLOYEE_ID_MIGRATION_KEY, "1");
  } catch {
    // non-fatal: the one-shot gate is best-effort dedupe only
  }
}

/**
 * One-shot employee-id backfill for legacy faculty rows missing an id.
 * Runs once per browser (localStorage gate) when a Setup writer opens the
 * Faculties tab — matches BE `setupWrite`. The POST goes through a `useMutation`
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
    mutationFn: () =>
      apiContract.faculty
        .migrateEmployeeIds({ body: {} })
        .then((res) => ({ updated: (res.body as { updated?: number } | null)?.updated ?? 0 })),
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
