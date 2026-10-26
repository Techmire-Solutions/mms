import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { tenantNotificationListSchema } from "../dashboard/tenantNotifications.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const success = z.object({ success: z.literal(true) });

/** `/api/notifications` — stored in-app notifications for the signed-in user. */
export const notificationsContract = c.router({
  listNotifications: {
    method: "GET",
    path: "/api/notifications",
    responses: { 200: tenantNotificationListSchema, 401: errorResponse, 500: errorResponse },
    summary: "Recent notifications addressed to the caller's permissions, with read state",
  },
  markNotificationRead: {
    method: "POST",
    path: "/api/notifications/:id/read",
    pathParams: z.object({ id: z.string().min(1) }),
    body: z.object({}).optional(),
    responses: { 200: success, 401: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: "Mark one notification read for the caller",
  },
  markAllNotificationsRead: {
    method: "POST",
    path: "/api/notifications/read-all",
    body: z.object({}).optional(),
    responses: { 200: success, 401: errorResponse, 500: errorResponse },
    summary: "Mark every visible notification read for the caller",
  },
});
