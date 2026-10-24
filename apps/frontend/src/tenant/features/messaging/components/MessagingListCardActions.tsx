import type React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";
import type { Message } from "@mms/shared";

interface MessagingListCardActionsProps {
  log: Message;
  name: string;
  canWrite: boolean;
  onResendLog: (log: Message) => void;
  onFilterContact?: (name: string) => void;
}

export function MessagingListCardActions({
  log,
  name,
  canWrite,
  onResendLog,
  onFilterContact,
}: MessagingListCardActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {onFilterContact && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onFilterContact(name);
          }}
          className="min-h-11 px-2.5 text-xs text-muted-foreground hover:text-primary"
        >
          <Filter className="me-1 h-3.5 w-3.5" />
          <span>{t("common.filters")}</span>
        </Button>
      )}
      {canWrite && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onResendLog(log);
          }}
          className={`min-h-11 px-2.5 text-xs font-semibold ${SEMANTIC_TEXT.primary} hover:bg-primary/10`}
        >
          <RotateCcw className="me-1 h-3.5 w-3.5" />
          {t("messaging.resend")}
        </Button>
      )}
    </>
  );
}
