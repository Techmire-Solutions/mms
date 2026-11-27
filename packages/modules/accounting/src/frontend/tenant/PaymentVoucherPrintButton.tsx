import { Printer } from "lucide-react";
import { Button } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import type { JournalEntry } from "./index";

/** Icon button that prints a voucher for one entry (Simple-mode lists, Cashbook). */
export function PaymentVoucherPrintButton({
  entry,
  onPrint,
}: {
  entry: JournalEntry;
  onPrint: (entry: JournalEntry) => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => onPrint(entry)}
      aria-label={`${t("accounting.journal.voucher.print")} ${entry.ref}`}
      title={t("accounting.journal.voucher.print")}
      className="min-h-11 min-w-11"
    >
      <Printer className="w-4 h-4" aria-hidden="true" />
    </Button>
  );
}
