import type React from "react";
import { CheckCircle2, Loader2, Unlink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/app/FormField";
import { FORM_ERROR_BOX } from "@/components/ui/formStyles";
import { Alert } from "@/components/app/Alert";
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
      <Alert
        icon={CheckCircle2}
        tone="success"
        title={t("contacts.sync.googleConnectedTitle")}
        description={t("contacts.sync.googleConnectedDesc")}
        action={
          canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="min-h-11 gap-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <Unlink className="h-3 w-3" />
              <span>{t("contacts.sync.disconnect")}</span>
            </Button>
          ) : undefined
        }
      />

      <FieldErrorMessage message={error || undefined} className={FORM_ERROR_BOX} />

      {syncResult && (
        <Alert
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
          variant="default"
          onClick={onSync}
          disabled={syncing}
          className="gap-2 min-h-11 px-5 font-semibold"
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
