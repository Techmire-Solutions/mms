import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useVoucherNumbering } from "@/tenant/features/accounting/hooks/useVoucherNumbering";

interface NextVoucherNumberHintProps {
  id: string;
  /** Voucher date — selects the counter when numbering restarts annually. */
  date?: string;
}

/** Previews the voucher number a blank reference will receive on save. */
export function NextVoucherNumberHint({
  id,
  date,
}: NextVoucherNumberHintProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useVoucherNumbering(date);
  if (!data) return null;
  return (
    <p id={id} className="m-0 mt-1 text-xs font-medium text-foreground" aria-live="polite">
      {data.autoGenerate
        ? t("accounting.journal.form.nextVoucherHint", { number: data.nextVoucherNumber })
        : t("accounting.journal.form.refRequiredManual")}
    </p>
  );
}
