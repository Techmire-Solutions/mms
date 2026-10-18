import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  academicCatalogItemSchema,
  academicCatalogKindSchema,
  academicCatalogListQuerySchema,
  academicCatalogWriteSchema,
} from "../sessions/academicCatalogTypes.js";

const c = initContract();
const errorResponse = z.unknown();
const catalogParams = z.object({ catalog: academicCatalogKindSchema });
const itemParams = catalogParams.extend({ id: z.string().min(1).max(64) });

/** Sessions-owned academic catalogs: session categories, programs, subjects. */
export const academicCatalogContract = c.router({
  list: {
    method: "GET",
    path: "/api/sessions/catalogs/:catalog",
    pathParams: catalogParams,
    query: academicCatalogListQuerySchema.optional(),
    responses: {
      200: z.object({ items: z.array(academicCatalogItemSchema) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List an academic catalog",
  },
  save: {
    method: "PUT",
    path: "/api/sessions/catalogs/:catalog/:id",
    pathParams: itemParams,
    body: academicCatalogWriteSchema,
    responses: {
      200: z.object({ item: academicCatalogItemSchema }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create or update an academic catalog entry",
  },
  remove: {
    method: "DELETE",
    path: "/api/sessions/catalogs/:catalog/:id",
    pathParams: itemParams,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary:
      "Soft-delete an academic catalog entry (409 when sessions, classes, periods or exams reference it)",
  },
  restore: {
    method: "POST",
    path: "/api/sessions/catalogs/:catalog/:id/restore",
    pathParams: itemParams,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ item: academicCatalogItemSchema }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted academic catalog entry",
  },
});

/** Examinations-owned read of the subjects catalog (no Sessions grant required). */
export const examinationSubjectsContract = c.router({
  list: {
    method: "GET",
    path: "/api/examinations/subjects",
    responses: {
      200: z.object({ items: z.array(academicCatalogItemSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List active subjects for exam forms",
  },
});
