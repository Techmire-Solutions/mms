/**
 * Literal paths for every tenant app surface.
 * Isolated from icons/components to avoid pulling Lucide or React into early bundles.
 */
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
