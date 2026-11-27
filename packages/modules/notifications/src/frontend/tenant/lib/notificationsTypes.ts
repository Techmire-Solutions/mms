import type React from "react";

/** Structural shapes shared by the notifications page and its host bindings. */
export interface DashboardNotificationTarget {
  kind: string;
  [key: string]: unknown;
}

export interface TenantNotification {
  id: string;
  type: string;
  title?: React.ReactNode;
  desc?: React.ReactNode;
  time?: React.ReactNode;
  urgent?: boolean;
  createdAt?: string;
  read: boolean;
  storedId?: string;
  target?: DashboardNotificationTarget;
  [key: string]: unknown;
}

export interface DashboardNotificationIconMeta {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  [key: string]: unknown;
}
