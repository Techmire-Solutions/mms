import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { CommandPaletteShell } from "@/components/app/CommandPaletteShell";
import { CommandResultsList, groupCommandResults } from "@/components/app/CommandResultsList";
import { cn } from "@/lib/utils";
import type { PlatformCommandItem } from "@/platform/features/shell/lib/platformCommandItems";
import { useOmniCommandRegistry } from "@/platform/features/shell/components/command/useOmniCommandRegistry";

export interface PlatformCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenAi?: () => void;
}

/**
 * Platform command palette — thin adapter over shared CommandPaletteShell
 * and the shared CommandResultsList.
 */
export function PlatformCommandPalette({
  open,
  onClose,
  onOpenAi,
}: PlatformCommandPaletteProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { filterItems, recordRecent } = useOmniCommandRegistry();

  const handleSelect = useCallback(
    (item: PlatformCommandItem) => {
      onClose();
      if (item.id === "ai-copilot") {
        onOpenAi?.();
        return;
      }
      if (
        item.customSubtitle &&
        (item.category === "platform.manageMadrasas" ||
          item.category === "platform.commandCategory.recent")
      ) {
        recordRecent({
          subdomain: item.customSubtitle,
          madrasaName: item.customLabel ?? item.customSubtitle,
        });
      }
      if (item.perform) {
        void item.perform();
      } else {
        navigate(item.path);
      }
    },
    [navigate, onClose, onOpenAi, recordRecent],
  );

  return (
    <CommandPaletteShell
      open={open}
      onClose={onClose}
      filterItems={filterItems}
      onSelect={handleSelect}
      ariaLabel={t("platform.openSearchAria")}
      searchPlaceholder={t("platform.searchConsolePlaceholder")}
      listboxId="platform-command-listbox"
      getActiveDescendantId={(item) => `platform-cmd-item-${item.id}`}
      getScreenReaderAnnouncement={(query, items) =>
        items.length === 0
          ? t("platform.noMatchingConsolePages", { query })
          : t("platform.searchResultsCount", { count: String(items.length) })
      }
      footerTitle={t("platform.consoleTitle")}
      dialogClassName="rounded-2xl text-start"
    >
      {({ query, filteredItems, selectedIndex, setSelectedIndex }) => (
        <CommandResultsList<PlatformCommandItem>
          listboxId="platform-command-listbox"
          flatItems={filteredItems}
          sections={groupCommandResults(filteredItems, (item) => t(item.category))}
          selectedIndex={selectedIndex}
          getItemId={(item) => `platform-cmd-item-${item.id}`}
          onSelect={handleSelect}
          onHoverIndex={setSelectedIndex}
          scrollClassName="max-h-80 p-2 pb-2 scroll-py-0"
          categoryHeaderClassName="px-3.5 pt-3 pb-1 font-black tracking-widest"
          rowClassName={(isSelected) =>
            cn(
              "rounded-xl px-3.5 py-2.5 h-auto whitespace-normal justify-start",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "active:scale-tap [&_svg]:pointer-events-none [&_svg]:size-4",
              isSelected ? "font-bold" : "font-semibold",
            )
          }
          emptyState={
            <div className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
              {t("platform.noMatchingConsolePages", { query })}
            </div>
          }
          renderRow={(item, isSelected) => {
            const Icon = item.icon;
            const translatedLabel = item.customLabel ?? (item.labelKey ? t(item.labelKey) : "");
            return (
              <>
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
              </>
            );
          }}
        />
      )}
    </CommandPaletteShell>
  );
}
