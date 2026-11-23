import React from "react";
import { Layers, Pencil, Trash2 } from "lucide-react";
import { Badge, Button } from "@shared/ui";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { ConsolidationGroup } from "@mms/shared";

/** Read-only consolidation-group detail drawer (members + intercompany codes). */
export function ConsolidationGroupDetailDrawer({
  group,
  onClose,
  onEdit,
  onDelete,
}: {
  group: ConsolidationGroup;
  onClose: () => void;
  onEdit: (group: ConsolidationGroup) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={group.name}
      subtitle={`${t("platform.consolidation.presentationCurrency")}: ${group.presentationCurrency}`}
      icon={Layers}
      ariaLabel={group.name}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => onEdit(group)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-destructive"
            onClick={() => onDelete(group.id)}
          >
            {t("common.delete")}
          </Button>
        </div>
      }
    >
      <SectionCard title={t("platform.consolidation.members")} icon={Layers}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {group.members.map((member) => (
            <div key={member.memberSubdomain} className="space-y-1">
              <dt className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {member.memberSubdomain}
                {member.isParent ? (
                  <Badge tone="primary" size="sm">
                    {t("platform.consolidation.isParent")}
                  </Badge>
                ) : null}
              </dt>
              <dd className="text-xs text-muted-foreground">
                {t("platform.consolidation.ownership")}: {member.ownershipPercent}%
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {group.intercompanyAccountCodes.length > 0 ? (
        <SectionCard title={t("platform.consolidation.intercompanyCodes")} icon={Layers}>
          <div className="flex flex-wrap gap-1.5">
            {group.intercompanyAccountCodes.map((code) => (
              <Badge key={code} tone="secondary" size="sm">
                {code}
              </Badge>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </DetailDrawerShell>
  );
}
