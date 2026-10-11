import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export function PlatformSidebarSearch({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="px-3 pt-3 pb-1 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpen}
        className="w-full justify-between px-3 text-xs text-sidebar-muted-foreground border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent hover:text-sidebar-foreground motion-reduce:transition-none"
        aria-label={t("platform.nav.searchConsole")}
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" aria-hidden />
          {t("platform.nav.searchConsole")}
        </span>
        <kbd
          aria-hidden="true"
          className="hidden sm:inline-flex rounded border border-sidebar-border bg-card px-1.5 text-3xs font-mono font-bold"
        >
          Ctrl / ⌘ K
        </kbd>
      </Button>
    </div>
  );
}
