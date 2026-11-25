/**
 * Platform apex console registry — the single declarative source of truth for
 * the protected platform console routes.
 *
 * Before this table, `ApexRoutes.tsx` repeated the same
 * `<PlatformBootGate requirePermission><Suspense><PlatformPageShell>…page…` block
 * ~10 times. The tree is now DERIVED from it:
 *   - {@link PLATFORM_CONSOLE_ENTRIES} → the console `<Route>` tree (grouped below)
 *   - {@link PLATFORM_CONSOLE_GROUPS}  → entries grouped by required permission
 *
 * The public entry routes (home / login / forgot-password / 2FA / tenant-not-found)
 * and the FirstRun gate stay explicit in `ApexRoutes.tsx` — they have bespoke
 * elements, not a loader.
 */
import type { PlatformAdminPermissionKey } from "@mms/contracts";
import { ROUTES } from "@/lib/config/routes";

export interface ApexConsoleEntry {
  /** Stable id (unique). */
  id: string;
  path: string;
  /** Grantable capability required; `null` ⇒ any authenticated platform user. */
  permission: PlatformAdminPermissionKey | null;
  /** Lazy page loader (absent for redirect entries). */
  loader?: () => Promise<unknown>;
  /** When set, the route redirects instead of rendering a page. */
  redirectTo?: string;
  /** Wrapped in `PlatformPageShell`; default true (`onboarding` opts out). */
  shell?: boolean;
}

/**
 * Canonical protected console surface. Order is not significant for routing;
 * group order below follows first appearance.
 */
export const PLATFORM_CONSOLE_ENTRIES: readonly ApexConsoleEntry[] = [
  {
    id: "platformAccount",
    path: ROUTES.platformAccount,
    permission: null,
    loader: () => import("@/platform/features/account/components/PlatformAccount"),
  },
  {
    id: "platformDashboard",
    path: ROUTES.platformDashboard,
    permission: null,
    loader: () => import("@/platform/features/dashboard/PlatformDashboardPage"),
  },
  {
    id: "platformWorkspaces",
    path: ROUTES.platformWorkspaces,
    permission: "workspaces",
    loader: () => import("@/platform/features/workspaces/PlatformWorkspacesPage"),
  },
  {
    id: "platformReports",
    path: ROUTES.platformReports,
    permission: "workspaces",
    redirectTo: `${ROUTES.platformWorkspaces}?tab=reports`,
  },
  {
    id: "platformConsolidation",
    path: ROUTES.platformConsolidation,
    permission: "workspaces",
    loader: () => import("@/platform/features/consolidation/PlatformConsolidationPage"),
  },
  {
    id: "onboarding",
    path: ROUTES.onboarding,
    permission: "onboard",
    loader: () => import("@/platform/features/onboarding/components/OnboardingWizard"),
    shell: false,
  },
  {
    id: "platformUsers",
    path: ROUTES.platformUsers,
    permission: "admins",
    loader: () => import("@/platform/features/users/PlatformUsersPage"),
  },
  {
    id: "platformAdmins",
    path: ROUTES.platformAdmins,
    permission: "admins",
    redirectTo: ROUTES.platformUsers,
  },
  {
    id: "platformSettings",
    path: ROUTES.platformSettings,
    permission: "settings",
    loader: () => import("@/platform/features/settings/PlatformSettingsPage"),
  },
  {
    id: "platformActivityLogs",
    path: ROUTES.platformActivityLogs,
    permission: "system",
    loader: () => import("@/platform/features/activity-logs/PlatformActivityLogsPage"),
  },
  {
    id: "platformSystem",
    path: ROUTES.platformSystem,
    permission: "system",
    loader: () => import("@/platform/features/system/PlatformSystemPage"),
  },
  {
    id: "platformErd",
    path: ROUTES.platformErd,
    permission: "system",
    loader: () => import("@/platform/features/erd/PlatformErdPage"),
  },
  {
    id: "platformDesignSystem",
    path: ROUTES.platformDesignSystem,
    permission: "system",
    loader: () => import("@/platform/features/design-system/PlatformDesignSystemPage"),
  },
  {
    id: "platformContacts",
    path: ROUTES.platformContacts,
    permission: "contacts",
    loader: () => import("@/platform/features/contacts/ContactsPage"),
  },
  {
    id: "platformMessaging",
    path: ROUTES.platformMessaging,
    permission: "messaging",
    loader: () => import("@/platform/features/messaging/MessagingPage"),
  },
];

export interface ApexConsoleGroup {
  permission: PlatformAdminPermissionKey | null;
  entries: ApexConsoleEntry[];
}

/** Entries grouped by their required permission, preserving first-seen order. */
export const PLATFORM_CONSOLE_GROUPS: readonly ApexConsoleGroup[] = PLATFORM_CONSOLE_ENTRIES.reduce<
  ApexConsoleGroup[]
>((groups, entry) => {
  let group = groups.find((candidate) => candidate.permission === entry.permission);
  if (!group) {
    group = { permission: entry.permission, entries: [] };
    groups.push(group);
  }
  group.entries.push(entry);
  return groups;
}, []);
