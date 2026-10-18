import { z } from "zod";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const usersRoleBreakdownItemSchema = z.object({
  role: z.string(),
  count: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Root aggregate schema
// ---------------------------------------------------------------------------

export const usersReportAggregatesSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  roleBreakdown: z.array(usersRoleBreakdownItemSchema),
  recentActivityCount: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type UsersRoleBreakdownItem = z.infer<typeof usersRoleBreakdownItemSchema>;
export type UsersReportAggregates = z.infer<typeof usersReportAggregatesSchema>;

/** Optional query params for GET /users/report-aggregates. */
export type UsersReportQuery = {
  dateFrom?: string;
  dateTo?: string;
};

// ---------------------------------------------------------------------------
// Empty sentinel
// ---------------------------------------------------------------------------

export const EMPTY_USERS_REPORT_AGGREGATES: UsersReportAggregates = {
  totalUsers: 0,
  activeUsers: 0,
  roleBreakdown: [],
  recentActivityCount: 0,
};
