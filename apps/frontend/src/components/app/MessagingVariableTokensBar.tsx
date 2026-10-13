import React from "react";
import { MESSAGING_VARIABLE_TOKENS, type AppTranslationKey, type VariableToken } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

export interface MessagingVariableTokensBarProps {
  onSelectToken: (token: string) => void;
  className?: string;
  showLabel?: boolean;
}

/**
 * Reusable variable token selector bar for message templates and campaign composition.
 */
export function MessagingVariableTokensBar({
  onSelectToken,
  className = "",
  showLabel = true,
}: MessagingVariableTokensBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {showLabel && (
        <span className="text-xs text-muted-foreground font-semibold me-1">
          {t("messaging.insertVariable")}:
        </span>
      )}
      {MESSAGING_VARIABLE_TOKENS.map(({ token, labelKey, fallbackExample }: VariableToken) => (
        <Button
          key={token}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelectToken(token)}
          title={t("messaging.variableExample", { example: fallbackExample })}
          aria-label={t(labelKey as AppTranslationKey)}
          className="h-auto min-h-11 px-1.5 py-2 rounded text-xs font-mono bg-muted hover:bg-primary/10 hover:text-primary border-border/40"
        >
          {token}
        </Button>
      ))}
    </div>
  );
}

export default MessagingVariableTokensBar;
