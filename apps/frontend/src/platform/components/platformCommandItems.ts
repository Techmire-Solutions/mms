import { Building2 } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { PLATFORM_STATIC_COMMANDS } from "@/platform/components/platformStaticCommands";

export type PlatformCommandCategory =
  | "platform.commandCategory.recent"
  | "platform.commandCategory.navigation"
  | "platform.commandCategory.actions"
  | "platform.manageMadrasas";

/** A console palette entry: static route command, direct action, or dynamic workspace link. */
export interface PlatformCommandItem {
  id: string;
  labelKey?: AppTranslationKey;
  customLabel?: string;
  customSubtitle?: string;
  category: PlatformCommandCategory;
  path: string;
  icon: React.ElementType;
  keywords: string[];
  badge?: string;
  shortcut?: string;
  actionType?: "navigate" | "action";
  perform?: () => void | Promise<void>;
  requiredPermission?: "workspaces" | "onboard" | "system" | "admins" | "settings";
}

export { PLATFORM_STATIC_COMMANDS };

/** Dynamic per-workspace palette entries (pre-filtered to the SearchBar `q` param on navigate). */
export function buildWorkspaceCommandItems(
  workspaces: PlatformWorkspaceRowData[],
): PlatformCommandItem[] {
  return workspaces.map((ws) => ({
    id: `ws-${ws.subdomain}`,
    customLabel: ws.madrasaName,
    customSubtitle: ws.subdomain,
    category: "platform.manageMadrasas",
    path: `${ROUTES.platformWorkspaces}?q=${encodeURIComponent(ws.subdomain)}`,
    icon: Building2,
    keywords: [ws.subdomain, ws.madrasaName, ws.enabled ? "active" : "inactive"],
  }));
}

/** Palette item visibility gate: `undefined` means everyone. */
export function commandItemIsPermitted(
  item: PlatformCommandItem,
  perms: {
    canWorkspaces: boolean;
    canOnboard: boolean;
    canSettings: boolean;
    canSystem: boolean;
    canAdmins: boolean;
  },
): boolean {
  if (!item.requiredPermission) return true;
  if (item.requiredPermission === "workspaces") return perms.canWorkspaces;
  if (item.requiredPermission === "onboard") return perms.canOnboard;
  if (item.requiredPermission === "settings") return perms.canSettings;
  if (item.requiredPermission === "system") return perms.canSystem;
  if (item.requiredPermission === "admins") return perms.canAdmins;
  return true;
}
