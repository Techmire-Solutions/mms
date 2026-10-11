import React from "react";
import { ChevronRight } from "lucide-react";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

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
          const handleKeyDown = isInteractive
            ? (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onViewSibling?.(sibling.id);
                }
              }
            : undefined;

          return (
            <div
              key={sibling.id}
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              onClick={isInteractive ? () => onViewSibling?.(sibling.id) : undefined}
              onKeyDown={handleKeyDown}
              className={cn(
                "p-3 transition-colors",
                isInteractive &&
                  "hover:bg-muted/60 cursor-pointer focus:outline-none focus-visible:bg-muted/60",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    id={sibling.id}
                    name={sibling.name}
                    gender={sibling.gender}
                    className="w-8 h-8 rounded-full text-xs font-bold shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
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
                          {t("students.grPrefix")}: {sibling.grNumber}
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
            </div>
          );
        })}
      </DetailSectionCard>
    </div>
  );
}
