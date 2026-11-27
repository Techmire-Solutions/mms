import type React from "react";
import { getNotificationsHost } from "../host.js";

/** Live view of the app icon map (value semantics; resolved on access). */
export const DASHBOARD_NOTIFICATION_ICONS: Record<
  string,
  { icon: React.ComponentType<any>; bg: string; text: string; [key: string]: unknown }
> = new Proxy(
  {},
  {
    get: (_target, key) => getNotificationsHost().DASHBOARD_NOTIFICATION_ICONS[String(key)],
  },
);
