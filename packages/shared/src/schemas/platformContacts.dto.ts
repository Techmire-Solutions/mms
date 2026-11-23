import { z } from "zod";

export const PLATFORM_CONTACT_KINDS = ["platform_operator", "workspace_admin", "external"] as const;

export const platformContactKindSchema = z.enum(PLATFORM_CONTACT_KINDS);

export const platformContactTagSchema = z.object({ id: z.string(), label: z.string() }).strict();

export const platformContactDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    kind: platformContactKindSchema,
    workspaceId: z.string().nullable().optional(),
    tags: z.array(platformContactTagSchema),
    notes: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional(),
  })
  .strict();

export const platformContactCreateInputSchema = z
  .object({
    name: z.string().min(1).max(160),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(32).nullable().optional(),
    kind: platformContactKindSchema,
    workspaceId: z.string().nullable().optional(),
    tags: z.array(platformContactTagSchema).default([]),
    notes: z.string().nullable().optional(),
  })
  .strict();

export const platformContactUpdateInputSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(32).nullable().optional(),
    tags: z.array(platformContactTagSchema).optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export const platformContactsListQuerySchema = z
  .object({
    search: z.string().optional(),
    kind: platformContactKindSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const platformContactsMetricsSchema = z
  .object({
    total: z.number(),
    byKind: z.record(platformContactKindSchema, z.number()),
    reachableEmail: z.number(),
    reachablePhone: z.number(),
  })
  .strict();

export type PlatformContactDto = z.infer<typeof platformContactDtoSchema>;
export type PlatformContactCreateInput = z.infer<typeof platformContactCreateInputSchema>;
export type PlatformContactUpdateInput = z.infer<typeof platformContactUpdateInputSchema>;
export type PlatformContactsListQuery = z.infer<typeof platformContactsListQuerySchema>;
export type PlatformContactsMetrics = z.infer<typeof platformContactsMetricsSchema>;
