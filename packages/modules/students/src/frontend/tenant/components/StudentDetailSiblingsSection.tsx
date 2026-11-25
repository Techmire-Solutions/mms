import React from "react";
import { ChevronRight } from "lucide-react";
import { DetailSectionCard } from "@mms/fe-core/components/DetailSectionCard";
import { UserAvatar } from "@mms/ui/app/UserAvatar";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { Badge } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { cn } from "@mms/ui";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";

export interface SiblingStudentItem {
  id: string;
  name: string;
  grNumber?: string;
  status?: string;
  gender?: string;
  sessionNames: string[];
}

export interface StudentDetailSiblingsSectionProps {
  siblings: SiblingStudentItem[];
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  onViewSibling?: (siblingId: string) => void;
}

export function StudentDetailSiblingsSection({
  siblings,
  statusBadgeConfig,
  onViewSibling,
}: StudentDetailSiblingsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (siblings.length === 0) return null;

  return (
    <div className="pt-2">
      <DetailSectionCard
        title={t("students.detail.siblings")}
        count={siblings.length}
        accentColor="success"
        className="divide-y divide-border/50 p-0"
      >
        {siblings.map((sibling) => {
          const isInteractive = Boolean(onViewSibling);
          const Component = isInteractive ? "button" : "div";

          return (
            <Component
              key={sibling.id}
              type={isInteractive ? "button" : undefined}
              onClick={isInteractive ? () => onViewSibling?.(sibling.id) : undefined}
              className={cn(
                "p-3 transition-colors w-full text-start block",
                isInteractive &&
                  "hover:bg-muted/60 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    id={sibling.id}
                    name={sibling.name}
                    gender={sibling.gender}
                    className="w-8 h-8 text-xs font-bold shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        dir="auto"
                        className="text-xs font-bold text-foreground truncate"
                        title={sibling.name}
                      >
                        {sibling.name}
                      </span>
                      {sibling.grNumber ? (
                        <Badge
                          as="span"
                          size="sm"
                          tone="primary"
                          className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                        >
                          {sibling.grNumber}
                        </Badge>
                      ) : null}
                      {sibling.status && (
                        <StatusBadge status={sibling.status} size="sm" config={statusBadgeConfig} />
                      )}
                    </div>
                    {sibling.sessionNames.length > 0 && (
                      <p
                        className="text-3xs text-muted-foreground truncate mt-0.5"
                        title={sibling.sessionNames.join(", ")}
                      >
                        {sibling.sessionNames.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {isInteractive && (
                  <ChevronRight
                    className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180"
                    aria-hidden
                  />
                )}
              </div>
            </Component>
          );
        })}
      </DetailSectionCard>
    </div>
  );
}
