/**
 * Tenant module registry — the single declarative source of truth for the
 * tenant application surface.
 *
 * Everything downstream is DERIVED from this table so a module is
 * added/renamed/removed in exactly one place:
 *   - `TENANT_PATHS`            → `ROUTES` keys in `@/lib/config/routes`
 *   - `TENANT_APP_PATHS`        → `isTenantAppPath` (apex host gating)
 *   - `TENANT_APP_ROUTE_ACCESS` → `@/lib/config/routeAccess`
 *   - `TENANT_ROUTE_LOADERS`    → `@/lib/routing/routePrefetch`
 *   - `TENANT_APP_ENTRIES`      → `NAV_ITEMS` and the tenant `<Route>` tree
 *
 * Lives in `lib/routing` deliberately: the boundary rule exempts `lib/routing`
 * because the routing layer is the sanctioned place that knows feature page
 * paths (lazy loaders). It owns the tenant path literals and imports nothing
 * from `routes.ts` (which composes `ROUTES` FROM this file) — keeping the
 * module graph acyclic.
 */
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  MessageSquare,
  Presentation,
  Scale,
  School,
  Settings,
  Star,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AccessControlledModuleId, AppTranslationKey, ModuleAction } from "@mms/shared";

/** Literal path for every tenant app surface (module pages + app-level pages). */
export const TENANT_PATHS = {
  home: "/",
  contacts: "/contacts",
  students: "/students",
  faculty: "/faculty",
  enrollments: "/enrollments",
  sessions: "/sessions",
  attendance: "/attendance",
  finance: "/finance",
  hasanatCards: "/hasanat-cards",
  examinations: "/examinations",
  questionBank: "/question-bank",
  workshops: "/workshops",
  accounting: "/accounting",
  obligations: "/obligations",
  tasks: "/tasks",
  messaging: "/messaging",
  users: "/users",
  profile: "/profile",
  notifications: "/notifications",
  settings: "/settings",
} as const;

export type TenantPathId = keyof typeof TENANT_PATHS;

/**
 * Access classification for a tenant route:
 * - `module`: owned by a module; gated on grant, enablement, and `action`.
 * - `landing`: Home — always reachable; its widgets/requests gate per module.
 * - `open`: not module-owned; any signed-in user (finer gating inside the page).
 */
export type TenantRouteAccess =
  | { kind: "module"; moduleId: AccessControlledModuleId; action: ModuleAction }
  | { kind: "landing"; moduleId: AccessControlledModuleId }
  | { kind: "open"; reason: string };

/** Sidebar presentation metadata for an entry. */
export interface TenantNavMeta {
  labelKey: AppTranslationKey;
  icon: LucideIcon;
  /** Sidebar position — ascending at the top level, or within the group. */
  order: number;
  /** Nested collapsible group id. */
  group?: "academics";
}

export interface TenantAppEntry {
  /** Stable id, matching the `ROUTES` key for module paths. */
  id: TenantPathId;
  path: string;
  access: TenantRouteAccess;
  /** Lazy page loader (warmed by route prefetch). */
  loader: () => Promise<unknown>;
  /** Sidebar entry; omit for routes that do not appear in navigation. */
  nav?: TenantNavMeta;
  /**
   * Included in `TENANT_APP_PATHS` — the paths that are invalid on the apex
   * host. Home is excluded (its `"/"` prefix would match everything) and
   * settings is excluded (the apex workspace gate matches it explicitly).
   */
  apexRedirectable?: boolean;
}

const moduleAccess = (moduleId: AccessControlledModuleId): TenantRouteAccess => ({
  kind: "module",
  moduleId,
  action: "read",
});

const ACADEMICS_GROUP = "academics" as const;
/** Sidebar slot for the "academics" group (between tasks and finance). */
export const ACADEMICS_GROUP_ORDER = 5;

/**
 * Canonical tenant app surface. Order here is not significant for routing or
 * path predicates; sidebar order comes from `nav.order` (+ `nav.group`).
 */
export const TENANT_APP_ENTRIES: readonly TenantAppEntry[] = [
  {
    id: "home",
    path: TENANT_PATHS.home,
    access: { kind: "landing", moduleId: "dashboard" },
    loader: () => import("@/tenant/features/dashboard/DashboardPage"),
    nav: { labelKey: "nav.dashboard", icon: LayoutDashboard, order: 0 },
  },
  {
    id: "contacts",
    path: TENANT_PATHS.contacts,
    access: moduleAccess("contacts"),
    loader: () => import("@/tenant/features/contacts/ContactsPage"),
    nav: { labelKey: "nav.contacts", icon: Users, order: 1 },
    apexRedirectable: true,
  },
  {
    id: "faculty",
    path: TENANT_PATHS.faculty,
    access: moduleAccess("faculty"),
    loader: () => import("@/tenant/features/faculty/FacultyPage"),
    nav: { labelKey: "nav.faculty", icon: School, order: 2 },
    apexRedirectable: true,
  },
  {
    id: "messaging",
    path: TENANT_PATHS.messaging,
    access: moduleAccess("messaging"),
    loader: () => import("@/tenant/features/messaging/MessagingPage"),
    nav: { labelKey: "nav.messaging", icon: MessageSquare, order: 3 },
    apexRedirectable: true,
  },
  {
    id: "tasks",
    path: TENANT_PATHS.tasks,
    access: moduleAccess("tasks"),
    loader: () => import("@/tenant/features/tasks/TasksPage"),
    nav: { labelKey: "nav.tasks", icon: CheckSquare, order: 4 },
    apexRedirectable: true,
  },
  {
    id: "students",
    path: TENANT_PATHS.students,
    access: moduleAccess("students"),
    loader: () => import("@/tenant/features/students/StudentsPage"),
    // Students is a daily destination, not a sub-tool of the Academics group.
    nav: { labelKey: "nav.students", icon: GraduationCap, order: 1.5 },
    apexRedirectable: true,
  },
  {
    id: "sessions",
    path: TENANT_PATHS.sessions,
    access: moduleAccess("sessions"),
    loader: () => import("@/tenant/features/sessions/SessionsPage"),
    nav: { labelKey: "nav.sessions", icon: Calendar, order: 1, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "enrollments",
    path: TENANT_PATHS.enrollments,
    access: moduleAccess("enrollment"),
    loader: () => import("@/tenant/features/enrollments/EnrollmentsPage"),
    nav: { labelKey: "nav.enrollments", icon: ClipboardList, order: 2, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "attendance",
    path: TENANT_PATHS.attendance,
    access: moduleAccess("attendance"),
    loader: () => import("@/tenant/features/attendance/AttendancePage"),
    nav: { labelKey: "nav.attendance", icon: UserCheck, order: 3, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "hasanatCards",
    path: TENANT_PATHS.hasanatCards,
    access: moduleAccess("hasanat"),
    loader: () => import("@/tenant/features/hasanat/HasanatCardsPage"),
    nav: { labelKey: "nav.hasanatCards", icon: Star, order: 4, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "examinations",
    path: TENANT_PATHS.examinations,
    access: moduleAccess("examination"),
    loader: () => import("@/tenant/features/examinations/ExaminationsPage"),
    nav: { labelKey: "nav.examinations", icon: FileText, order: 5, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "questionBank",
    path: TENANT_PATHS.questionBank,
    access: moduleAccess("questionBank"),
    loader: () => import("@/tenant/features/question-bank/QuestionBankPage"),
    nav: { labelKey: "nav.questionBank", icon: Library, order: 6, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "workshops",
    path: TENANT_PATHS.workshops,
    access: moduleAccess("workshops"),
    loader: () => import("@/tenant/features/workshops/WorkshopsPage"),
    nav: { labelKey: "nav.workshops", icon: Presentation, order: 7, group: ACADEMICS_GROUP },
    apexRedirectable: true,
  },
  {
    id: "finance",
    path: TENANT_PATHS.finance,
    access: moduleAccess("finance"),
    loader: () => import("@/tenant/features/finance/FinancePage"),
    nav: { labelKey: "nav.finance", icon: DollarSign, order: 6 },
    apexRedirectable: true,
  },
  {
    id: "accounting",
    path: TENANT_PATHS.accounting,
    access: moduleAccess("accounting"),
    loader: () => import("@/tenant/features/accounting/AccountingPage"),
    nav: { labelKey: "nav.accounting", icon: TrendingUp, order: 7 },
    apexRedirectable: true,
  },
  {
    id: "obligations",
    path: TENANT_PATHS.obligations,
    access: moduleAccess("obligations"),
    loader: () => import("@/tenant/features/obligations/ObligationsPage"),
    nav: { labelKey: "nav.obligations", icon: Scale, order: 8 },
    apexRedirectable: true,
  },
  {
    id: "users",
    path: TENANT_PATHS.users,
    access: moduleAccess("users"),
    loader: () => import("@/tenant/features/users/UsersPage"),
    nav: { labelKey: "nav.users", icon: UserCog, order: 9 },
    apexRedirectable: true,
  },
  {
    id: "profile",
    path: TENANT_PATHS.profile,
    access: { kind: "open", reason: "the signed-in user's own account" },
    loader: () => import("@/tenant/features/profile/AccountProfilePage"),
    apexRedirectable: true,
  },
  {
    id: "notifications",
    path: TENANT_PATHS.notifications,
    access: {
      kind: "open",
      reason: "the signed-in user's own alerts; each alert gates its module permission",
    },
    loader: () => import("@/tenant/features/notifications/NotificationsPage"),
    apexRedirectable: true,
  },
  {
    id: "settings",
    path: TENANT_PATHS.settings,
    access: {
      kind: "open",
      reason: "workspace settings; each section gates its own permission",
    },
    loader: () => import("@/tenant/features/settings/SettingsPage"),
    nav: { labelKey: "nav.settings", icon: Settings, order: 10 },
  },
];

/** Entries that are invalid on the apex host, for `isTenantAppPath`. */
export const TENANT_APP_PATHS: readonly string[] = TENANT_APP_ENTRIES.filter(
  (entry) => entry.apexRedirectable,
).map((entry) => entry.path);

/** Route path → module-access rule. */
export const TENANT_APP_ROUTE_ACCESS: Readonly<Record<string, TenantRouteAccess>> =
  Object.fromEntries(TENANT_APP_ENTRIES.map((entry) => [entry.path, entry.access]));

/** Route path → lazy page loader (consumed by route prefetch). */
export const TENANT_ROUTE_LOADERS: Readonly<Record<string, () => Promise<unknown>>> =
  Object.fromEntries(TENANT_APP_ENTRIES.map((entry) => [entry.path, entry.loader]));
