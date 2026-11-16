import React, { useState } from "react";
import { normalizeBrandingHex } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Field } from "@/components/app/FormPrimitives";
import { Textarea } from "@/components/ui/textarea";
import { FormModal } from "@/components/app/FormModal";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";
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
  const { isDirty } = useDirtySnapshot(importRawText, String(open), "");

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
    <FormModal
      open={open}
      onClose={handleClose}
      title={t("theme.importPaletteTitle")}
      subtitle={t("theme.importPaletteDesc")}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t("theme.importPaletteAction")}
      saveDisabled={!parsedCandidate}
      onSave={handleConfirmImport}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      formId="brand-color-import-form"
    >
      <form
        id="brand-color-import-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleConfirmImport();
        }}
      >
        <div className="space-y-4 py-1">
          <Field id="import-palette-input" label={t("theme.importPaletteInputLabel")} required>
            <Textarea
              id="import-palette-input"
              value={importRawText}
              onChange={(e) => setImportRawText(e.target.value)}
              placeholder={t("theme.importPalettePlaceholder")}
              rows={4}
              className="font-mono text-xs"
            />
          </Field>

          {parsedCandidate ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/30 animate-in fade-in duration-200">
              <div className="flex items-center -space-x-2 rtl:space-x-reverse">
                <span
                  className="size-8 rounded-md border-2 border-background shadow-xs shrink-0"
                  aria-hidden="true"
                  style={{ backgroundColor: parsedCandidate.primary }}
                />
                <span
                  className="size-8 rounded-md border-2 border-background shadow-xs shrink-0"
                  aria-hidden="true"
                  style={{ backgroundColor: parsedCandidate.secondary }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {parsedCandidate.primary} & {parsedCandidate.secondary}
                </p>
                <p className="text-2xs text-success font-semibold truncate">
                  {t("theme.paletteValid")}
                </p>
              </div>
            </div>
          ) : importRawText.trim() ? (
            <p className="text-xs text-destructive font-medium px-1">
              {t("theme.pastePaletteInvalid")}
            </p>
          ) : null}
        </div>
      </form>
    </FormModal>
  );
}
