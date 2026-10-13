import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";
import { cn } from "@/lib/utils";
import { COMMAND_ITEMS, type CommandItem } from "@/components/ui/commandPaletteItems";
import { CommandPaletteModal } from "@/components/ui/CommandPaletteModal";
import { useCommandPaletteSearch } from "@/components/ui/useCommandPaletteSearch";
import { getRecents, pushRecent, filterCommandItems } from "@/components/ui/commandPaletteUtils";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Hides destinations the viewer cannot open (module access); all items when omitted. */
  isPathVisible?: (path: string) => boolean;
}

export function CommandPalette({
  open,
  onClose,
  isPathVisible,
}: CommandPaletteProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const items = useMemo(
    () =>
      isPathVisible ? COMMAND_ITEMS.filter((item) => isPathVisible(item.path)) : COMMAND_ITEMS,
    [isPathVisible],
  );

  const translate = useCallback(
    (key: string) => {
      try {
        const val = t(key as AppTranslationKey);
        return typeof val === "string" && val ? val : "";
      } catch {
        return "";
      }
    },
    [t],
  );

  const handleSelect = useCallback(
    (item: CommandItem) => {
      pushRecent(item.id);
      onClose();
      navigate(item.path);
    },
    [navigate, onClose],
  );

  const filterItems = useCallback(
    (currentQuery: string) => filterCommandItems(items, currentQuery, translate),
    [items, translate],
  );

  const {
    query,
    setQuery,
    filteredItems: activeFilteredItems,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  } = useCommandPaletteSearch<CommandItem>({
    filterItems,
    onSelect: handleSelect,
    onClose,
  });

  const recentIds = useMemo(() => (open ? getRecents() : []), [open]);
  const recentItems = useMemo(
    () => recentIds.map((id) => items.find((c) => c.id === id)).filter(Boolean) as CommandItem[],
    [items, recentIds],
  );

  const isEmptyQuery = !query.trim();

  /** Build grouped sections for display */
  const sections = useMemo(() => {
    if (!isEmptyQuery) {
      const groups = new Map<string, CommandItem[]>();
      for (const item of activeFilteredItems) {
        const cat = translate(item.categoryKey) || item.fallbackCategory;
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(item);
      }
      return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
    }
    const groups = new Map<string, CommandItem[]>();
    if (recentItems.length > 0) groups.set("__recents__", recentItems);
    for (const item of items) {
      const cat = translate(item.categoryKey) || item.fallbackCategory;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  }, [isEmptyQuery, activeFilteredItems, recentItems, items, translate]);

  // Flat ordered list matching keyboard navigation
  const flatItems = useMemo(() => {
    if (!isEmptyQuery) return activeFilteredItems;
    return sections.flatMap((s) => s.items);
  }, [isEmptyQuery, activeFilteredItems, sections]);

  return (
    <CommandPaletteModal
      open={open}
      onClose={onClose}
      ariaLabel={t("common.commandPalette")}
      searchPlaceholder={translate("nav.globalSearchPlaceholder")}
      query={query}
      onQueryChange={setQuery}
      onKeyDown={handleKeyDown}
      listboxId="tenant-command-listbox"
      activeDescendantId={
        flatItems[selectedIndex] ? `tenant-cmd-item-${flatItems[selectedIndex].id}` : undefined
      }
      footerTitle="MMS"
    >
      <div className="max-h-80 overflow-y-auto p-2" role="listbox" id="tenant-command-listbox">
        {flatItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("nav.globalSearchNoResults", { query })}
          </div>
        ) : (
          sections.map(({ category, items }) => {
            const isRecents = category === "__recents__";
            return (
              <div key={category} className="mb-1">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  {isRecents && <Clock className="h-3 w-3" aria-hidden="true" />}
                  {isRecents ? t("nav.recentItems" as AppTranslationKey) || "Recent" : category}
                </div>
                {items.map((item) => {
                  const globalIndex = flatItems.indexOf(item);
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = item.icon;
                  const translatedLabel = translate(item.labelKey) || item.fallbackLabel;
                  return (
                    <button
                      key={item.id}
                      id={`tenant-cmd-item-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        "flex w-full min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-foreground hover:bg-muted/70",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0",
                          isSelected ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{translatedLabel}</span>
                      <span
                        className={cn(
                          "text-xs font-mono",
                          isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                        )}
                      >
                        {item.path}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </CommandPaletteModal>
  );
}
