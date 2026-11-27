import { getNotificationsHost } from "../host.js";

export function useOpenTenantNotification(): (target: unknown) => void {
  return getNotificationsHost().useOpenTenantNotification();
}
