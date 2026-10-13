import type React from "react";
import { CheckCircle2, Loader2, Unlink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/app/FormField";
import { FORM_ERROR_BOX } from "@/components/ui/formStyles";
import { WarningCallout } from "@/components/app/WarningCallout";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { GoogleContactsSyncRunResult } from "@mms/shared";

export interface GoogleContactsConnectedStateProps {
  canWrite: boolean;
  error: string;
  syncResult: GoogleContactsSyncRunResult | null;
  syncing: boolean;
  onDisconnect: () => void;
  onSync: () => void;
  t: TranslationFunction;
}

export function GoogleContactsConnectedState({
  canWrite,
  error,
  syncResult,
  syncing,
  onDisconnect,
  onSync,
  t,
}: GoogleContactsConnectedStateProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <WarningCallout
        icon={CheckCircle2}
        tone="success"
        title={t("contacts.sync.googleConnectedTitle")}
        description={t("contacts.sync.googleConnectedDesc")}
        action={
          canWrite ? (
            <Button
              type="button"
              variant="outline"
              onClick={onDisconnect}
              className="flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground shadow-none transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Unlink className="h-3 w-3" />
              <span>{t("contacts.sync.disconnect")}</span>
            </Button>
          ) : undefined
        }
      />

      <FieldErrorMessage message={error || undefined} className={FORM_ERROR_BOX} />

      {syncResult && (
        <WarningCallout
          icon={CheckCircle2}
          tone="success"
          density="compact"
          title={t("contacts.sync.syncCompleteTitle", { total: syncResult.total })}
          description={
            <>
              {t("contacts.sync.syncCompleteDesc", {
                imported: syncResult.imported,
                updated: syncResult.updated ?? 0,
                skipped: syncResult.skipped,
              })}
              {syncResult.skippedUnique > 0
                ? ` ${t("contacts.sync.skippedUniqueCount", { count: syncResult.skippedUnique })}`
                : ""}
            </>
          }
        />
      )}

      {canWrite && (
        <Button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-none transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("contacts.sync.syncing")}</span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              <span>{t("contacts.sync.syncGoogle")}</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
