import React, { useMemo, useState } from "react";
import { Building2, ChevronsUpDown, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import {
  loadRecentWorkspaces,
  saveRecentWorkspace,
  type RecentWorkspaceRecord,
} from "@/platform/lib/recentWorkspaces";
import { ROUTES } from "@/lib/config/routes";
import { Button } from "@/components/ui/button";
import { LeadingIconInput } from "@/components/ui/LeadingIconInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 8;

/** Header control: jump to a recent or searched workspace in the directory / open tenant. */
export function PlatformWorkspaceSwitcher(): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canWorkspaces } = usePlatformPermissions();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentWorkspaceRecord[]>(() => loadRecentWorkspaces());
  const { data } = usePlatformWorkspaces({
    limit: PAGE_SIZE,
    search: query.trim() || undefined,
  });

  const hits = useMemo(() => data ?? [], [data]);

  if (!canWorkspaces) return null;

  const jumpToDirectory = (subdomain: string, madrasaName: string) => {
    const updated = saveRecentWorkspace({ subdomain, madrasaName });
    setRecents(updated);
    void navigate(`${ROUTES.platformWorkspaces}?q=${encodeURIComponent(subdomain)}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="hidden md:inline-flex min-h-11 max-w-[14rem] gap-2 rounded-xl border-border/80 px-3 text-xs font-bold cursor-pointer"
          aria-label={t("platform.workspaceSwitcher")}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{t("platform.workspaceSwitcher")}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2 rounded-xl shadow-md">
        <LeadingIconInput
          icon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("platform.workspaceSwitcherSearch")}
          aria-label={t("platform.workspaceSwitcherSearch")}
          className="mb-2"
        />
        {recents.length > 0 && !query.trim() ? (
          <>
            <DropdownMenuLabel className="text-3xs uppercase tracking-wide text-muted-foreground">
              {t("platform.workspaceSwitcherRecent")}
            </DropdownMenuLabel>
            {recents.map((r) => (
              <DropdownMenuItem
                key={`recent-${r.subdomain}`}
                className="cursor-pointer gap-2 rounded-lg text-xs font-semibold"
                onSelect={() => jumpToDirectory(r.subdomain, r.madrasaName)}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate flex-1">{r.madrasaName}</span>
                <span className="text-3xs text-muted-foreground font-mono shrink-0">
                  {r.subdomain}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuLabel className="text-3xs uppercase tracking-wide text-muted-foreground">
          {query.trim() ? t("platform.workspaceSwitcherResults") : t("platform.manageMadrasas")}
        </DropdownMenuLabel>
        {hits.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground text-pretty">
            {t("platform.workspaceSwitcherEmpty")}
          </p>
        ) : (
          hits.map((w) => (
            <DropdownMenuItem
              key={w.subdomain}
              className="cursor-pointer gap-2 rounded-lg text-xs font-semibold"
              onSelect={() => jumpToDirectory(w.subdomain, w.madrasaName)}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate flex-1">{w.madrasaName}</span>
              <span className="text-3xs text-muted-foreground font-mono shrink-0">
                {w.subdomain}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
