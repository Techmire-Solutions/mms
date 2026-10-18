import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { PlatformCommandItem } from "@/platform/components/platformCommandItems";

export interface PlatformCommandResultsListProps {
  filteredItems: readonly PlatformCommandItem[];
  selectedIndex: number;
  query: string;
  onSelect: (path: string, item?: PlatformCommandItem) => void;
  onHoverIndex: (index: number) => void;
}

export function PlatformCommandResultsList({
  filteredItems,
  selectedIndex,
  query,
  onSelect,
  onHoverIndex,
}: PlatformCommandResultsListProps): React.JSX.Element {
  const { t } = useTranslation();

  if (filteredItems.length === 0) {
    return (
      <div className="max-h-80 overflow-y-auto p-2" role="listbox" id="platform-command-listbox">
        <div className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          {t("platform.noMatchingConsolePages", { query })}
        </div>
      </div>
    );
  }

  const grouped = filteredItems.reduce<Record<string, PlatformCommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="max-h-80 overflow-y-auto p-2" role="listbox" id="platform-command-listbox">
      {Object.entries(grouped).map(([categoryKey, items]) => (
        <div key={categoryKey} className="mb-1">
          <div className="px-3.5 pt-3 pb-1 text-3xs font-black uppercase tracking-widest text-muted-foreground select-none">
            {t(categoryKey as AppTranslationKey)}
          </div>
          {items.map((item) => {
            const index = filteredItems.indexOf(item);
            const Icon = item.icon;
            const isSelected = index === selectedIndex;
            const translatedLabel = item.customLabel ?? (item.labelKey ? t(item.labelKey) : "");
            return (
              <Button
                key={item.id}
                id={`platform-cmd-item-${item.id}`}
                type="button"
                variant="ghost"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item.path, item)}
                onMouseEnter={() => onHoverIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-sm h-auto whitespace-normal justify-start cursor-pointer min-h-11",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-foreground hover:bg-muted/70 font-semibold",
                )}
              >
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0",
                    isSelected ? "text-primary-foreground" : "text-primary",
                  )}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{translatedLabel}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-3xs font-semibold rounded-md uppercase tracking-wider",
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground border border-border/40",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.customSubtitle && (
                    <span
                      className={cn(
                        "text-2xs font-mono truncate",
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {item.customSubtitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "text-xs opacity-70 font-mono hidden sm:inline",
                      isSelected ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.path}
                  </span>
                  {item.shortcut ? (
                    <kbd
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-mono rounded shadow-2xs",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground border border-border/60",
                      )}
                    >
                      {item.shortcut}
                    </kbd>
                  ) : isSelected ? (
                    <span className="text-3xs font-mono opacity-80">↵</span>
                  ) : null}
                </div>
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
