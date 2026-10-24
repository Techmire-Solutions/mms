import React, { type JSX } from "react";
import { getInitials, type StandardMessagingRecipient } from "@mms/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModuleTableSelectionCell } from "@/components/app/ModuleTableSelectionCell";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BG, SEMANTIC_TEXT, SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

export interface TenantMessageComposerRecipientTableProps {
  recipients: StandardMessagingRecipient[];
  selectedIds: Set<string>;
  disabled?: boolean;
  onToggle: (recipient: StandardMessagingRecipient) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
}

export function TenantMessageComposerRecipientTable({
  recipients,
  selectedIds,
  disabled,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
}: TenantMessageComposerRecipientTableProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="relative w-full overflow-auto">
      <Table className="w-full text-xs">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 px-3 py-2">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={onToggleAll}
                  disabled={disabled || recipients.length === 0}
                  aria-label={t("common.selectAll")}
                />
              </div>
            </TableHead>
            <TableHead className="px-3 py-2 text-start font-medium text-muted-foreground">
              {t("messaging.recipient")}
            </TableHead>
            <TableHead className="px-3 py-2 text-start font-medium text-muted-foreground">
              {t("contacts.form.primaryPhone")}
            </TableHead>
            <TableHead className="px-3 py-2 text-start font-medium text-muted-foreground">
              {t("contacts.form.primaryEmail")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((recipient) => {
            const idStr = String(recipient.id);
            const isSelected = selectedIds.has(idStr);

            return (
              <TableRow
                key={idStr}
                className={cn(
                  "cursor-pointer transition-colors border-b border-border/50",
                  isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30",
                )}
                onClick={() => {
                  if (!disabled) onToggle(recipient);
                }}
              >
                <ModuleTableSelectionCell
                  checked={isSelected}
                  onCheckedChange={() => {}}
                  ariaLabel={t("messaging.selectRecipient", { name: recipient.name })}
                  sticky={false}
                  stopPropagation={true}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onToggle(recipient);
                  }}
                  className="px-3 py-2"
                />
                <TableCell className="px-3 py-2 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${SEMANTIC_BG.primary} text-3xs font-black ${SEMANTIC_TEXT.primary}`}
                    >
                      {getInitials(recipient.name)}
                    </span>
                    <span className="truncate">{recipient.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 font-mono text-muted-foreground" dir="ltr">
                  {recipient.phone || (
                    <Badge
                      variant="outline"
                      className={`text-3xs font-medium ${SEMANTIC_BADGE.warning}`}
                    >
                      {t("messaging.missingPhone")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground" dir="ltr">
                  {recipient.email || (
                    <Badge
                      variant="outline"
                      className={`text-3xs font-medium ${SEMANTIC_BADGE.warning}`}
                    >
                      {t("messaging.missingEmail")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
