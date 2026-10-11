import { quickActionLabel } from "./quickActionLabels";
import { createElement } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getTransactionGroupColorClasses,
  type QuickActionType,
} from "./simpleTransactionWizardTypes";

interface SimpleTransactionHeaderProps {
  type: QuickActionType;
  onChangeType?: () => void;
}

export function SimpleTransactionHeader({ type, onChangeType }: SimpleTransactionHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getTransactionGroupColorClasses(type.color).icon}`}
          aria-hidden="true"
        >
          {createElement(type.icon, { className: "w-5 h-5" })}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate m-0">
            {quickActionLabel(type, t)}
          </h3>
          <p className="text-xs text-muted-foreground truncate m-0">{t(type.groupKey)}</p>
        </div>
      </div>
      {onChangeType && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onChangeType}
          className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {t("accounting.journal.dashboard.wizard.changeType")}
        </Button>
      )}
    </header>
  );
}
