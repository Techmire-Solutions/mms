import type React from "react";
import { FileText, RefreshCw, Upload } from "lucide-react";
import type { Contact } from "@mms/shared";
import { getDisplayName, getPrimaryEmail, getPrimaryPhone } from "@mms/shared";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface AppleContactsPreviewListProps {
  previewList: Contact[];
  fileName?: string | null;
  importing: boolean;
  onClear: () => void;
  onImport: () => void;
  onChooseDifferent: () => void;
  t: TranslationFunction;
}

export function AppleContactsPreviewList({
  previewList,
  fileName,
  importing,
  onClear,
  onImport,
  onChooseDifferent,
  t,
}: AppleContactsPreviewListProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          {fileName && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-medium text-foreground max-w-48 truncate"
              title={fileName}
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{fileName}</span>
            </span>
          )}
          <p className="min-w-0 text-sm font-semibold text-foreground">
            {previewList.length} {t("contacts.sync.contactsFound")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className="text-xs min-h-11 min-w-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-transparent shadow-none"
        >
          {t("contacts.sync.clear")}
        </Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2 bg-card">
        {previewList.slice(0, 50).map((contact, contactIndex) => (
          <div
            key={contactIndex}
            className="flex min-w-0 items-center justify-between gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/50 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {getDisplayName(contact)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 ms-2">
              {getPrimaryPhone(contact) || getPrimaryEmail(contact) || ""}
            </span>
          </div>
        ))}
        {previewList.length > 50 && (
          <p className="text-xs text-center text-muted-foreground py-1">
            {t("contacts.sync.andMore", { count: previewList.length - 50 })}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onImport}
          disabled={importing}
          className="flex items-center gap-2 px-5 min-h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-none"
        >
          {importing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{t("contacts.sync.importCount", { count: previewList.length })}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onChooseDifferent}
          className="px-4 min-h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-card shadow-none"
        >
          {t("contacts.sync.chooseDifferentFile")}
        </Button>
      </div>
    </div>
  );
}
