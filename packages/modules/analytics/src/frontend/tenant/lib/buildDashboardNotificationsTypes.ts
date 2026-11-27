/** Structural stand-ins for the app-owned dashboard notification builder. */
export type DashboardNotificationType = string;
export interface DashboardNotificationItem {
  id: string;
  type: DashboardNotificationType;
  target?: unknown;
  [key: string]: unknown;
}
export type DashboardNotificationTarget = unknown;
