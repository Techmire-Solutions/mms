import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { scopedStorageKey } from "@/lib/dbStorageCore";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { invalidateStudentsQueries } from "@/tenant/features/students/hooks/invalidateStudentsQueries";

const STUDENTS_GR_MIGRATION_KEY = "students_gr_migration_v1";

/** Workspace-scoped gate: the backfill must run once per tenant, not once per browser. */
function grMigrationStorageKey(): string {
  return scopedStorageKey(STUDENTS_GR_MIGRATION_KEY);
}

function grMigrationAlreadyDone(): boolean {
  try {
    return localStorage.getItem(grMigrationStorageKey()) === "1";
  } catch {
    return false;
  }
}

function markGrMigrationDone(): void {
  try {
    localStorage.setItem(grMigrationStorageKey(), "1");
  } catch {
    // non-fatal: the one-shot gate is best-effort dedupe only
  }
}

interface GrMigrationResult {
  success: boolean;
  updated: number;
  /** The route caps one call at 100 rows and asks the caller to re-invoke while true. */
  hasMore?: boolean;
}

/** Safety bound for one Work visit; the server's own cap is 100 rows per call. */
const MAX_MIGRATION_CHUNKS = 20;

/**
 * One-shot GR number backfill for legacy students missing `grNumber`.
 * Runs once per workspace (tenant-scoped localStorage gate) when a Setup writer
 * opens the Work tab — matches BE `setupWrite`. The POST goes through a `useMutation` so the
 * outcome surfaces via `notify.*` + `t()` instead of silent console warnings.
 */
export function useGrMigration(activeTab: string, canEditSetup: boolean): void {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [needsMigrationScan, setNeedsMigrationScan] = useState(() => !grMigrationAlreadyDone());
  const migrationAppliedRef = useRef(false);

  useEffect(() => {
    if (!canEditSetup || !needsMigrationScan || activeTab !== "work") return;
    if (migrationAppliedRef.current) return;
    migrationAppliedRef.current = true;

    let cancelled = false;
    void (async () => {
      let updatedTotal = 0;
      let completed = false;
      try {
        // The route processes at most 100 students per call and reports `hasMore`, so
        // keep re-invoking (bounded) instead of gating after the first chunk — that left
        // every student past #100 without a GR number forever (2026-11-04 review, M5).
        for (let chunk = 0; chunk < MAX_MIGRATION_CHUNKS; chunk += 1) {
          const res = await apiContract.students.migrateGrNumbers({ body: {} });
          if (cancelled) return;
          assertContractOk(res, "Failed to backfill GR numbers");
          const result = res.body as GrMigrationResult;
          updatedTotal += result.updated ?? 0;
          if (!result.hasMore) {
            completed = true;
            break;
          }
        }
        invalidateStudentsQueries(queryClient);
        if (!completed) {
          // More work remains: leave the one-shot gate unset so the next Work visit
          // resumes instead of declaring the migration finished.
          migrationAppliedRef.current = false;
          return;
        }
        markGrMigrationDone();
        setNeedsMigrationScan(false);
        if (updatedTotal > 0) {
          notify.success(t("students.grMigrationCompleted"), {
            description: t("students.grMigrationUpdated", { count: updatedTotal }),
          });
        }
      } catch {
        if (cancelled) return;
        migrationAppliedRef.current = false;
        notify.error(t("students.grMigrationFailed"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canEditSetup, needsMigrationScan, queryClient, t]);
}
