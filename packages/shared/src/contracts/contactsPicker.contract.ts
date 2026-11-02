import { z } from "zod";
import {
  contactPickerResolveResponseSchema,
  contactPickerSearchQuerySchema,
  contactPickerSearchResponseSchema,
} from "../contacts/contactPicker.js";

/**
 * Lean contact-picker routes.
 *
 * Mounted outside the `contacts.read` gate: any role that can read the
 * students, faculty, or workshops module may resolve a person to link, but the
 * payload is capped to `contactPickerOptionSchema`.
 */
export const contactsPickerRoutes = {
  search: {
    method: "GET",
    path: "/api/contacts/picker",
    query: contactPickerSearchQuerySchema,
    responses: {
      200: contactPickerSearchResponseSchema,
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Search contacts for a picker",
  },
  get: {
    method: "GET",
    path: "/api/contacts/picker/:id",
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: contactPickerResolveResponseSchema,
      403: z.unknown(),
      404: z.unknown(),
      500: z.unknown(),
    },
    summary: "Resolve one contact for a picker",
  },
} as const;
