import type React from "react";
import { Loader2 } from "lucide-react";
import type { Contact, SyncFieldPick } from "@mms/shared";
import { resolveSyncFieldLabel } from "@/lib/contacts/contactI18n";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { Button } from "@/components/ui/button";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

export interface SyncDiff {
  field: string;
  local: string;
  server: string;
}

function conflictPickButtonClass(selected: boolean, dense: boolean): string {
  return cn(
    "text-start break-all w-full rounded h-auto justify-start font-normal",
    dense ? "px-1" : "px-2 py-1.5 min-h-11",
    selected ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/50",
  );
}

export interface ContactsSyncConflictDiffBodyProps {
  local: Contact | undefined;
  serverContact: Contact | undefined;
  serverLoading: boolean;
  diffs: SyncDiff[];
  fieldPicks: Record<string, SyncFieldPick>;
  applying: boolean;
  onTogglePick: (field: string, pick: SyncFieldPick) => void;
  onApplyMerge: () => void;
  onKeepMine: () => void;
  onUseServer: () => void;
  t: TranslationFunction;
  viewMode?: WorkDirectoryViewMode;
}

export function ContactsSyncConflictDiffBody({
  local,
  serverContact,
  serverLoading,
  diffs,
  fieldPicks,
  applying,
  onTogglePick,
  onApplyMerge,
  onKeepMine,
  onUseServer,
  t,
  viewMode: propViewMode,
}: ContactsSyncConflictDiffBodyProps): React.JSX.Element {
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  return (
    <div className="border-t border-warning/20 px-3 py-2.5 bg-background/40 space-y-3">
      {serverLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t("contacts.sync.conflictLoadingServer")}
        </p>
      )}

      {local && diffs.length > 0 ? (
        <>
          <p className="text-xs font-semibold text-foreground">
            {t("contacts.sync.conflictDiffTitle")}
          </p>
          {viewMode === "cards" ? (
            <div className="space-y-3">
              {diffs.map((diff) => (
                <article key={diff.field} className={`${WORK_SURFACE_INNER} space-y-2 p-3`}>
                  <p className="text-xs font-semibold text-foreground">
                    {resolveSyncFieldLabel(diff.field, t)}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("contacts.sync.conflictLocal")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onTogglePick(diff.field, "local")}
                        className={conflictPickButtonClass(
                          fieldPicks[diff.field] === "local",
                          false,
                        )}
                      >
                        {diff.local}
                      </Button>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("contacts.sync.conflictServer")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onTogglePick(diff.field, "server")}
                        className={conflictPickButtonClass(
                          fieldPicks[diff.field] === "server",
                          false,
                        )}
                      >
                        {diff.server}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow className="text-muted-foreground border-0 hover:bg-transparent">
                    <TableHead className="text-start py-1 pe-2 font-medium h-auto">
                      {t("contacts.sync.conflictField")}
                    </TableHead>
                    <TableHead className="text-start py-1 pe-2 font-medium h-auto">
                      {t("contacts.sync.conflictLocal")}
                    </TableHead>
                    <TableHead className="text-start py-1 font-medium h-auto">
                      {t("contacts.sync.conflictServer")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map((diff) => (
                    <TableRow
                      key={diff.field}
                      className="border-t border-border/50 hover:bg-transparent"
                    >
                      <TableCell className="py-1 pe-2 font-medium">
                        {resolveSyncFieldLabel(diff.field, t)}
                      </TableCell>
                      <TableCell className="py-1 pe-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onTogglePick(diff.field, "local")}
                          className={conflictPickButtonClass(
                            fieldPicks[diff.field] === "local",
                            true,
                          )}
                        >
                          {diff.local}
                        </Button>
                      </TableCell>
                      <TableCell className="py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onTogglePick(diff.field, "server")}
                          className={conflictPickButtonClass(
                            fieldPicks[diff.field] === "server",
                            true,
                          )}
                        >
                          {diff.server}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : local ? (
        <p className="text-xs text-muted-foreground">
          {serverContact
            ? t("contacts.sync.conflictDiffEmpty")
            : t("contacts.sync.conflictNoServer")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("contacts.sync.conflictDeleteHint")}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {local && (
          <Button type="button" size="sm" disabled={applying} onClick={onApplyMerge}>
            {t("contacts.sync.conflictApplyMerge")}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" disabled={applying} onClick={onKeepMine}>
          {t("contacts.sync.conflictKeepLocal")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={applying} onClick={onUseServer}>
          {t("contacts.sync.conflictUseServer")}
        </Button>
      </div>
    </div>
  );
}
