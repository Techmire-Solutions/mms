import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { invalidateStudentsQueries } from "@/tenant/features/students/hooks/invalidateStudentsQueries";

const STUDENTS_GR_MIGRATION_KEY = "mms_students_gr_migration_v1";

function grMigrationAlreadyDone(): boolean {
  try {
    return localStorage.getItem(STUDENTS_GR_MIGRATION_KEY) === "1";
  } catch {
    return false;
  }
}

function markGrMigrationDone(): void {
  try {
    localStorage.setItem(STUDENTS_GR_MIGRATION_KEY, "1");
  } catch {
    // non-fatal: the one-shot gate is best-effort dedupe only
  }
}

interface GrMigrationResult {
  success: boolean;
  updated: number;
}

/**
 * One-shot GR number backfill for legacy students missing `grNumber`.
 * Runs once per browser (localStorage gate) when a Setup writer opens the Work
 * tab — matches BE `setupWrite`. The POST goes through a `useMutation` so the
 * outcome surfaces via `notify.*` + `t()` instead of silent console warnings.
 */
export function useGrMigration(activeTab: string, canEditSetup: boolean): void {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [needsMigrationScan, setNeedsMigrationScan] = useState(() => !grMigrationAlreadyDone());
  const migrationAppliedRef = useRef(false);

  const { mutate } = useMutation({
    mutationFn: () =>
      apiContract.students
        .migrateGrNumbers({ body: {} })
        .then((res) => res.body as GrMigrationResult),
    onSuccess: (result: GrMigrationResult) => {
      invalidateStudentsQueries(queryClient);
      markGrMigrationDone();
      setNeedsMigrationScan(false);
      if (result.updated > 0) {
        notify.success(t("students.grMigrationCompleted"), {
          description: t("students.grMigrationUpdated", { count: result.updated }),
        });
      }
    },
    onError: () => {
      migrationAppliedRef.current = false;
      notify.error(t("students.grMigrationFailed"));
    },
  });

  useEffect(() => {
    if (!canEditSetup || !needsMigrationScan || activeTab !== "work") return;
    if (migrationAppliedRef.current) return;
    migrationAppliedRef.current = true;
    mutate();
  }, [activeTab, canEditSetup, needsMigrationScan, mutate]);
}
