import type { BadgeTone } from "@shared/ui";
import { Trash2, PlusCircle, RefreshCw, Key, Settings, Terminal } from "lucide-react";
import type React from "react";

export type LogCategory = "all" | "auth" | "workspace" | "system" | "admin";

export function getActionCategory(action: string): LogCategory {
  const a = action.toLowerCase();
  if (a.includes("login") || a.includes("auth") || a.includes("password")) return "auth";
  if (
    a.includes("workspace") ||
    a.includes("onboard") ||
    a.includes("enable") ||
    a.includes("disable")
  )
    return "workspace";
  if (
    a.includes("migrate") ||
    a.includes("restart") ||
    a.includes("reset") ||
    a.includes("setting")
  )
    return "system";
  if (a.includes("admin") || a.includes("user") || a.includes("permission")) return "admin";
  return "system";
}

export function getActionMeta(action: string): { tone: BadgeTone; Icon: React.ElementType } {
  if (
    action.includes("delete") ||
    action.includes("disable") ||
    action.includes("purge") ||
    action.includes("reset")
  ) {
    return { tone: "destructive", Icon: Trash2 };
  }
  if (action.includes("create") || action.includes("enable") || action.includes("onboard")) {
    return { tone: "success", Icon: PlusCircle };
  }
  if (action.includes("migrate") || action.includes("restart") || action.includes("reload")) {
    return { tone: "info", Icon: RefreshCw };
  }
  if (action.includes("login") || action.includes("auth") || action.includes("password")) {
    return { tone: "warning", Icon: Key };
  }
  if (action.includes("setting") || action.includes("config") || action.includes("update")) {
    return { tone: "primary", Icon: Settings };
  }
  return { tone: "primary", Icon: Terminal };
}
