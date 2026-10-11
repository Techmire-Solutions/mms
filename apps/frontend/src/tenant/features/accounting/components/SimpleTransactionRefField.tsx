import { Field } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { NextVoucherNumberHint } from "./NextVoucherNumberHint";
import { useTranslation } from "@/hooks/useTranslation";

interface SimpleTransactionRefFieldProps {
  prefix: string;
  refValue: string;
  date: string;
  isDuplicateRef: boolean;
  onChange: (val: string) => void;
  onProceed?: () => void;
}

export function SimpleTransactionRefField({
  prefix,
  refValue,
  date,
  isDuplicateRef,
  onChange,
  onProceed,
}: SimpleTransactionRefFieldProps) {
  const { t } = useTranslation();

  return (
    <Field
      id={`${prefix}-ref`}
      label={t("accounting.journal.dashboard.wizard.refNo")}
      error={
        isDuplicateRef ? t("accounting.journal.dashboard.wizard.errorRefDuplicate") : undefined
      }
      errorId={isDuplicateRef ? `${prefix}-ref-error` : undefined}
      hint={refValue.trim() ? t("accounting.journal.dashboard.wizard.optional") : undefined}
    >
      <Input
        id={`${prefix}-ref`}
        name="ref"
        autoComplete="off"
        value={refValue}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!isDuplicateRef) {
              onProceed?.();
            }
          }
        }}
        placeholder={t("accounting.journal.dashboard.wizard.refPlaceholder")}
        aria-invalid={isDuplicateRef}
        aria-describedby={
          isDuplicateRef
            ? `${prefix}-ref-error`
            : refValue.trim()
              ? undefined
              : `${prefix}-ref-next`
        }
      />
      {!isDuplicateRef && !refValue.trim() && (
        <NextVoucherNumberHint id={`${prefix}-ref-next`} date={date} />
      )}
    </Field>
  );
}
