import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { parseMoneyInput } from "../lib/simpleTransactionMoney";

interface SimpleTransactionAmountInputProps {
  prefix: string;
  amount: string;
  currencySymbol: string;
  currencyPaddingClass: string;
  showAmountRequired: boolean;
  amountIsInvalid: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onProceed?: () => void;
}

export function SimpleTransactionAmountInput({
  prefix,
  amount,
  currencySymbol,
  currencyPaddingClass,
  showAmountRequired,
  amountIsInvalid,
  onChange,
  onBlur,
  onProceed,
}: SimpleTransactionAmountInputProps) {
  const { t } = useTranslation();

  const handleIncrement = (inc: number) => {
    onBlur();
    const current = parseMoneyInput(amount) ?? 0;
    const next = current + inc;
    onChange(next % 1 === 0 ? String(next) : next.toFixed(2));
  };

  const errorMessage = showAmountRequired
    ? t("accounting.journal.dashboard.wizard.errorAmount")
    : amountIsInvalid
      ? t("accounting.journal.dashboard.wizard.errorAmountInvalid")
      : undefined;

  return (
    <div>
      <Field
        id={`${prefix}-amount`}
        label={t("accounting.journal.dashboard.wizard.amount")}
        error={errorMessage}
      >
        <div className="relative">
          <span
            className="absolute start-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none select-none"
            aria-hidden="true"
          >
            {currencySymbol}
          </span>
          <Input
            id={`${prefix}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={amount}
            onFocus={(event) => event.target.select()}
            onBlur={onBlur}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onProceed?.();
              }
            }}
            style={{
              paddingInlineStart:
                currencySymbol.length > 2
                  ? "3.5rem"
                  : currencySymbol.length > 1
                    ? "2.75rem"
                    : "2rem",
            }}
            className={`${currencyPaddingClass} text-lg font-bold`}
          />
        </div>
      </Field>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {[100, 500, 1000, 5000].map((inc) => (
          <Button
            key={inc}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleIncrement(inc)}
            className="min-h-11 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            +{inc.toLocaleString()}
          </Button>
        ))}
      </div>
    </div>
  );
}
