import type React from "react";
import { FileText, RefreshCw, Upload } from "lucide-react";
import type { Contact } from "@mms/shared";
import { getDisplayName, getPrimaryEmail, getPrimaryPhone } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
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
            <Badge
              variant="secondary"
              className="gap-1.5 max-w-48 font-medium truncate"
              title={fileName}
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{fileName}</span>
            </Badge>
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          onClick={onImport}
          disabled={importing}
          className="gap-2 min-h-11 px-5 font-semibold"
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
          className="min-h-11 px-4 font-medium"
        >
          {t("contacts.sync.chooseDifferentFile")}
        </Button>
      </div>
    </div>
  );
}
