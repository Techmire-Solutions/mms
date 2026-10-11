import React, { useState } from "react";
import { normalizeBrandingHex } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { notify } from "@/lib/notify";

export function parseImportCandidate(raw: string): { primary: string; secondary: string } | null {
  if (!raw.trim()) return null;
  try {
    const trimmed = raw.trim();
    let primary = "";
    let secondary = "";

    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as {
        primary?: string;
        accent?: string;
        secondary?: string;
      };
      primary = parsed.primary ?? "";
      secondary = parsed.accent ?? parsed.secondary ?? "";
    } else if (trimmed.includes(",") || trimmed.includes(" ")) {
      const parts = trimmed
        .split(/[, ]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      primary = parts[0] ?? "";
      secondary = parts[1] ?? "";
    }

    const normPrimary = normalizeBrandingHex(primary, "");
    const normSecondary = normalizeBrandingHex(secondary, "");

    if (!normPrimary || !normSecondary) return null;
    return { primary: normPrimary, secondary: normSecondary };
  } catch {
    return null;
  }
}

interface BrandColorImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (primary: string, secondary: string) => void;
}

export function BrandColorImportModal({
  open,
  onClose,
  onImport,
}: BrandColorImportModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [importRawText, setImportRawText] = useState("");

  const parsedCandidate = parseImportCandidate(importRawText);

  const handleClose = (): void => {
    onClose();
    setImportRawText("");
  };

  const handleConfirmImport = (): void => {
    if (!parsedCandidate) return;
    onImport(parsedCandidate.primary, parsedCandidate.secondary);
    setImportRawText("");
    notify.success(t("theme.pastePaletteSuccess"));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("theme.importPaletteTitle")}
      subtitle={t("theme.importPaletteDesc")}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="min-h-10 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!parsedCandidate}
            onClick={handleConfirmImport}
            className="min-h-10 px-4 text-xs font-semibold"
          >
            {t("theme.importPaletteAction")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <div className="space-y-2">
          <Label htmlFor="import-palette-input">{t("theme.importPaletteInputLabel")}</Label>
          <Textarea
            id="import-palette-input"
            value={importRawText}
            onChange={(e) => setImportRawText(e.target.value)}
            placeholder={t("theme.importPalettePlaceholder")}
            rows={4}
            autoFocus
            className="font-mono text-xs"
          />
        </div>

        {parsedCandidate ? (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/30 animate-in fade-in duration-200">
            <div className="flex items-center -space-x-2 rtl:space-x-reverse">
              <span
                className="h-8 w-8 rounded-full border-2 border-background shadow-xs shrink-0"
                style={{ backgroundColor: parsedCandidate.primary }}
              />
              <span
                className="h-8 w-8 rounded-full border-2 border-background shadow-xs shrink-0"
                style={{ backgroundColor: parsedCandidate.secondary }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {parsedCandidate.primary} & {parsedCandidate.secondary}
              </p>
              <p className="text-2xs text-success font-semibold truncate">Valid palette detected</p>
            </div>
          </div>
        ) : importRawText.trim() ? (
          <p className="text-xs text-destructive font-medium px-1">
            {t("theme.pastePaletteInvalid")}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
