import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { CommandPaletteShell } from "@/components/app/CommandPaletteShell";
import type { PlatformCommandItem } from "@/platform/components/platformCommandItems";
import { PlatformCommandResultsList } from "@/platform/components/command/PlatformCommandResultsList";
import { useOmniCommandRegistry } from "@/platform/components/command/useOmniCommandRegistry";

export interface PlatformCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenAi?: () => void;
}

/**
 * Platform command palette — thin adapter over shared CommandPaletteShell.
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
      {({ query, setQuery, filteredItems, selectedIndex, setSelectedIndex }) => (
        <PlatformCommandResultsList
          filteredItems={filteredItems}
          selectedIndex={selectedIndex}
          query={query}
          onSelect={(_path, item) => {
            if (item) {
              handleSelect(item);
            } else {
              onClose();
              setQuery("");
              navigate(_path);
            }
          }}
          onHoverIndex={setSelectedIndex}
        />
      )}
    </CommandPaletteShell>
  );
}
