import React from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DirectoryCard } from "@/components/ui/DirectoryCard";
import { EntityCard } from "@/components/ui/EntityCard";
import { EntityCardMetaTile } from "@/components/ui/EntityCardMetaTile";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

import { useTranslation } from "@/hooks/useTranslation";
import { ACCOUNT_TYPE_META, type Account } from "@/lib/data/accountingData";

export interface AccountRowActionsProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
}

export function AccountRowActions({
  account,
  onEdit,
  onDelete,
  onReactivate,
}: AccountRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("accounting.coa.editAria", { name: account.name })}
        onClick={() => onEdit(account)}
        className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      {account.isActive === false ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("accounting.coa.reactivateAria", { name: account.name })}
          onClick={() => onReactivate(account.id)}
          className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:text-success"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("accounting.coa.deactivateAria", { name: account.name })}
          onClick={() => onDelete(account.id)}
          className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:text-destructive"
        >
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </>
  );
}

export interface AccountRecordProps {
  account: Account;
  balanceConfig: Record<string, StatusBadgeConfigItem>;
  canWrite: boolean;
  isColumnVisible: (key: string) => boolean;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
}

/** Work/setup entity card — DirectoryCard SSOT (do not hand-compose EntityCard). */
export function AccountMobileCard({
  account,
  balanceConfig,
  canWrite,
  isColumnVisible,
  onEdit,
  onDelete,
  onReactivate,
}: AccountRecordProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DirectoryCard
      entity={account}
      canSelect={false}
      className={cn("space-y-3 p-4", account.isActive === false && "opacity-50")}
      headerSlot={
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isColumnVisible("code") && (
              <p className="m-0 font-mono text-xs font-bold text-muted-foreground">
                {account.code}
              </p>
            )}
            {isColumnVisible("name") && (
              <h4 className="m-0 mt-0.5 text-sm font-semibold text-foreground">
                {account.name}
                {account.isActive === false && (
                  <Badge as="span" pill tone="muted" className="ms-2 px-1.5">
                    {t("accounting.coa.inactive")}
                  </Badge>
                )}
              </h4>
            )}
          </div>
          {isColumnVisible("normalBalance") && (
            <StatusBadge
              status={
                ACCOUNT_TYPE_META[account.type]?.normalBalance === "debit" ? "debit" : "credit"
              }
              config={balanceConfig}
              size="sm"
            />
          )}
        </div>
      }
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("subtype") && (
            <EntityCardMetaTile label={t("accounting.columns.account.subtype")}>
              {account.subtype || "—"}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("description") && (
            <EntityCardMetaTile
              label={t("accounting.columns.account.description")}
              className="break-words"
            >
              {account.description || "—"}
            </EntityCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      actions={
        canWrite ? (
          <AccountRowActions
            account={account}
            onEdit={onEdit}
            onDelete={onDelete}
            onReactivate={onReactivate}
          />
        ) : undefined
      }
    />
  );
}
