import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveNavLabel, type ResolvedIndustryTerminology } from "@/lib/config/navLabels";
import type { AppTranslationKey } from "@mms/contracts";
import { cn } from "@mms/ui";
import { COMMAND_ITEMS, type CommandItem } from "@/components/app/commandPaletteItems";
import { CommandPaletteModal } from "@mms/fe-core/components/CommandPaletteModal";
import { useCommandPaletteSearch } from "@mms/ui/app/useCommandPaletteSearch";
import { CommandResultsList, groupCommandResults } from "@mms/ui/app/CommandResultsList";
import { getRecents, pushRecent, filterCommandItems } from "@/components/app/commandPaletteUtils";
import { prefetchRoute } from "@/lib/routing/routePrefetch";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Hides destinations the viewer cannot open (module access); all items when omitted. */
  isPathVisible?: (path: string) => boolean;
  /** Industry terminology profile; when omitted, labels fall back to plain translations. */
  terminology?: ResolvedIndustryTerminology;
}

export function CommandPalette({
  open,
  onClose,
  isPathVisible,
  terminology,
}: CommandPaletteProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const items = useMemo(
    () =>
      isPathVisible ? COMMAND_ITEMS.filter((item) => isPathVisible(item.path)) : COMMAND_ITEMS,
    [isPathVisible],
  );

  const translate = useCallback(
    (key: AppTranslationKey) =>
      terminology ? resolveNavLabel(key, terminology, t) : t(key as "nav.dashboard"),
    [terminology, t],
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
      return groupCommandResults(activeFilteredItems, (item) => translate(item.categoryKey));
    }
    return [
      ...(recentItems.length > 0
        ? [{ category: "__recents__", items: recentItems as readonly CommandItem[] }]
        : []),
      ...groupCommandResults(items, (item) => translate(item.categoryKey)),
    ];
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
      <CommandResultsList<CommandItem>
        listboxId="tenant-command-listbox"
        flatItems={flatItems}
        sections={sections}
        selectedIndex={selectedIndex}
        getItemId={(item) => `tenant-cmd-item-${item.id}`}
        onSelect={handleSelect}
        onHoverIndex={setSelectedIndex}
        onHoverItem={(item) => {
          // Warm the target chunk on explicit hover intent (not on every
          // arrow-key selection, which is noisy and test-hostile).
          prefetchRoute(item.path);
        }}
        recentsCategoryKey="__recents__"
        recentsLabel={t("nav.recentItems")}
        emptyState={
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("nav.globalSearchNoResults", { query })}
          </div>
        }
        renderRow={(item, isSelected) => {
          const Icon = item.icon;
          return (
            <>
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0",
                  isSelected ? "text-primary-foreground" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{translate(item.labelKey)}</span>
              <span
                className={cn(
                  "text-xs font-mono",
                  isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                )}
              >
                {item.path}
              </span>
            </>
          );
        }}
      />
    </CommandPaletteModal>
  );
}
