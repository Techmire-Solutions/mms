import type React from "react";
import { UserPlus, AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface ContactsPageHeaderActionsProps {
  canExport: boolean;
  canRead: boolean;
  canWrite: boolean;
  viewingDeleted: boolean;
  openingDuplicates: boolean;
  /** Server export in flight — the CTA shows a spinner and blocks re-entry. */
  isExporting?: boolean;
  onOpenDuplicates: () => void;
  onExport: () => void;
  /** Opens the vCard import dialog (`contacts.write`). */
  onImport: () => void;
  onAddContact: () => void;
}

export function ContactsPageHeaderActions({
  canExport,
  canRead,
  canWrite,
  viewingDeleted,
  openingDuplicates,
  isExporting = false,
  onOpenDuplicates,
  onExport,
  onImport,
  onAddContact,
}: ContactsPageHeaderActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {canRead && !viewingDeleted && (
        <Button
          variant="ghost"
          icon={openingDuplicates ? Loader2 : AlertTriangle}
          onClick={onOpenDuplicates}
          disabled={openingDuplicates}
        >
          {t("contacts.duplicates")}
        </Button>
      )}
      {canExport && !viewingDeleted && (
        <Button
          variant="ghost"
          icon={Download}
          onClick={onExport}
          loading={isExporting}
          aria-busy={isExporting}
        >
          {t("common.export")}
        </Button>
      )}
      {canWrite && !viewingDeleted && (
        <Button variant="ghost" icon={Upload} onClick={onImport}>
          {t("contacts.import")}
        </Button>
      )}
      {canWrite && !viewingDeleted && (
        <Button variant="primary" icon={UserPlus} onClick={onAddContact}>
          {t("contacts.addContact")}
        </Button>
      )}
    </>
  );
}
