import React from "react";
import { Edit3, Files, Trash2 } from "lucide-react";
import type { MessageTemplate } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { CopyBtn } from "@/components/app/CopyButton";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BG, SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

export interface MessagingTemplateActionButtonsProps {
  template: MessageTemplate;
  canWrite: boolean;
  onCopy: (body: string) => void;
  onDuplicate: (template: MessageTemplate) => void;
  onEdit: (template: MessageTemplate) => void;
  onDeleteRequest: (id: string) => void;
}

export function MessagingTemplateActionButtons({
  template,
  canWrite,
  onCopy,
  onDuplicate,
  onEdit,
  onDeleteRequest,
}: MessagingTemplateActionButtonsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <CopyBtn
        text={template.body}
        title={t("messaging.copyTemplate")}
        className="min-h-11 min-w-11 rounded-xl"
        onCopy={() => onCopy(template.body)}
      />
      {canWrite && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDuplicate(template)}
          className={`min-h-11 min-w-11 rounded-xl border-primary/30 ${SEMANTIC_BG.primary} ${SEMANTIC_TEXT.primary} hover:bg-primary/15 hover:border-primary/40 shadow-none`}
          title={t("messaging.duplicateTemplate")}
          aria-label={t("messaging.duplicateTemplate")}
        >
          <Files className="h-4 w-4" />
        </Button>
      )}
      {canWrite && template.id.startsWith("custom_") ? (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onEdit(template)}
            className={`min-h-11 min-w-11 rounded-xl border-info/30 ${SEMANTIC_BG.info} ${SEMANTIC_TEXT.info} hover:bg-info/15 hover:border-info/40 shadow-none`}
            title={t("common.edit")}
            aria-label={t("common.edit")}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDeleteRequest(template.id)}
            className={`min-h-11 min-w-11 rounded-xl border-destructive/30 ${SEMANTIC_BG.destructive} ${SEMANTIC_TEXT.destructive} hover:bg-destructive/15 hover:border-destructive/40 shadow-none`}
            title={t("common.delete")}
            aria-label={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <span className="rounded border border-border/30 bg-muted/65 px-1.5 py-0.5 font-mono text-xs italic uppercase text-muted-foreground">
          {t("messaging.tagSystem")}
        </span>
      )}
    </div>
  );
}
