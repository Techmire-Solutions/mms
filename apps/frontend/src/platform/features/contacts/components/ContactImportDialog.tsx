import React, { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@shared/ui";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { triggerFileDownload } from "@/lib/download";
import type { PlatformContactCreateInput } from "@mms/shared";
import { useCreatePlatformContact } from "@/platform/features/contacts/hooks/usePlatformContacts";
import {
  CONTACTS_IMPORT_TEMPLATE_CSV,
  parseContactsCsv,
} from "@/platform/features/contacts/lib/parseContactsCsv";

/** CSV import dialog (small-batch, synchronous) for the platform contact directory. */
export function ContactImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const create = useCreatePlatformContact();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PlatformContactCreateInput[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [skipped, setSkipped] = useState(0);

  const handleFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const result = parseContactsCsv(text);
    setRows(result.rows);
    setErrors(result.errors);
    setSkipped(result.skipped);
  };

  const downloadTemplate = (): void => {
    const blob = new Blob([CONTACTS_IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    triggerFileDownload(blob, "platform_contacts_import_template.csv");
  };

  const handleImport = async (): Promise<void> => {
    for (const row of rows) {
      await create.mutateAsync(row);
    }
    onImported(rows.length);
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("platform.contacts.importTitle")}
      saveLabel={t("platform.contacts.import")}
      onSave={handleImport}
      isDirty={true}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("settings.unsavedChanges")}
      saving={create.isPending}
      saveDisabled={rows.length === 0 || errors.length > 0}
      tall
    >
      <div className="space-y-4">
        <Field id="contact-import-file" label={t("platform.contacts.importFile")}>
          <input
            ref={inputRef}
            id="contact-import-file"
            type="file"
            accept=".csv,text/csv"
            aria-label={t("platform.contacts.importFile")}
            className="text-sm text-foreground"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </Field>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Download}
          onClick={downloadTemplate}
        >
          {t("platform.contacts.downloadTemplate")}
        </Button>

        {fileName ? (
          <div className="text-sm text-muted-foreground">
            {t("platform.contacts.importPreview", {
              count: String(rows.length),
              skipped: String(skipped),
            })}
          </div>
        ) : null}

        {errors.length > 0 ? (
          <ul className="space-y-1 text-sm text-destructive">
            {errors.slice(0, 10).map((error) => (
              <li key={`${error.row}-${error.error}`}>
                {t("platform.contacts.importRowError", { row: String(error.row) })}: {error.error}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FormModal>
  );
}
