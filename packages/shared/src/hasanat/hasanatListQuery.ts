import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { distributionRecordSchema } from "./hasanatModuleManifest.js";
import { HASANAT_CARD_STATUSES, type HasanatCardStatus } from "./hasanatCardRules.js";

/**
 * `status` is a comma-separated list on the wire (`active,redeemed`). Each token is validated here:
 * a typo used to reach the repository, match nothing, and return an empty list with a 200.
 */
const statusFilterSchema = z
  .string()
  .max(200)
  .refine(
    (raw) =>
      raw
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .every((token) => (HASANAT_CARD_STATUSES as readonly string[]).includes(token)),
    { message: `status must be a comma-separated list of: ${HASANAT_CARD_STATUSES.join(", ")}` },
  );

/** Query accepted by the hasanat distributions list endpoint (validated, strict). */
export const hasanatListQuerySchema = baseListQuerySchema
  .extend({ status: statusFilterSchema.optional() })
  .strict();

export type HasanatListQuery = z.infer<typeof hasanatListQuerySchema>;

/** Comma-separated `status` as typed card statuses (server-side parsing helper). */
export function parseHasanatStatusFilter(status: string | undefined): HasanatCardStatus[] {
  return (status ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token): token is HasanatCardStatus =>
      (HASANAT_CARD_STATUSES as readonly string[]).includes(token),
    );
}

/** Paginated hasanat distributions response — the single page DTO (Zod owns the shape). */
export const hasanatDistributionsPageResponseSchema = z.object({
  distributions: z.array(distributionRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export type HasanatDistributionsListPageResult = z.infer<
  typeof hasanatDistributionsPageResponseSchema
>;
