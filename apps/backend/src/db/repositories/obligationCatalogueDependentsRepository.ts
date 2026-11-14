/**
 * @file obligationCatalogueDependentsRepository.ts
 * @description Counts the rows a catalogue delete would take with it.
 *
 * `mujtahids → mujtahid_reps → wakala_types → obligation_distributions` is a three-level
 * `ON DELETE CASCADE` (0068), so a `replace*ForWorkspace` that omits a row silently deletes
 * everything hanging off it. The use cases ask this repository what would be lost *before*
 * deleting, and refuse the write (409) when the answer is non-zero — see
 * `obligations/domain/obligationWriteGuards.assertNoCascadingLoss`.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import {
  mujtahidReps,
  obligationCollections,
  obligationDistributions,
  wakalaTypes,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/** Catalogue rows a delete of `kind` would cascade to. */
export interface CatalogueDependents {
  /** `wakala_types` rows that would be deleted (their distribution rules follow). */
  wakalaTypes: number;
  /** `obligation_distributions` rows that would be deleted. */
  distributions: number;
  /**
   * Posted receipts that would be deleted with the catalogue row.
   *
   * `obligation_collections_rep_fk` and `obligation_collections_obligation_type_fk` are
   * `ON DELETE CASCADE`, so removing a representative or an obligation type also destroys every
   * receipt that references it. The counter ignored this entirely — a type or rep with no wakala
   * read as "0 dependents" and the guard waved the delete through (test-suite audit G3).
   */
  receipts: number;
}

export type CatalogueKind = "mujtahid" | "representative" | "wakala" | "obligationType";

/**
 * Counts the wakala types and distribution rules that deleting `ids` would cascade to.
 *
 * - `wakala`: the ids are the wakala rows themselves, so only their rules are counted.
 * - `representative`: wakala types pointing at those reps, plus their rules.
 * - `mujtahid`: reps of those mujtahids, then the wakalas of those reps, then their rules.
 */
export async function countCatalogueDependents(
  tenant: string,
  kind: CatalogueKind,
  ids: readonly string[],
): Promise<CatalogueDependents> {
  const cleanIds = dedupeTrimmedIds([...ids]);
  if (cleanIds.length === 0) return { wakalaTypes: 0, distributions: 0, receipts: 0 };
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    if (kind === "wakala") {
      const [rules] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(obligationDistributions)
        .where(
          and(
            eq(obligationDistributions.workspaceSubdomain, subdomain),
            inArray(obligationDistributions.wakalaTypeId, cleanIds),
          ),
        );
      return {
        wakalaTypes: 0,
        distributions: Number(rules?.count ?? 0),
        receipts: 0,
      };
    }

    if (kind === "obligationType") {
      const [receipts] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(obligationCollections)
        .where(
          and(
            eq(obligationCollections.workspaceSubdomain, subdomain),
            inArray(obligationCollections.obligationTypeId, cleanIds),
          ),
        );
      return { wakalaTypes: 0, distributions: 0, receipts: Number(receipts?.count ?? 0) };
    }

    const repIds =
      kind === "representative"
        ? cleanIds
        : (
            await tx
              .select({ id: mujtahidReps.id })
              .from(mujtahidReps)
              .where(
                and(
                  eq(mujtahidReps.workspaceSubdomain, subdomain),
                  inArray(mujtahidReps.mujtahidId, cleanIds),
                ),
              )
          ).map((row) => row.id);

    const wakalaIds =
      repIds.length === 0
        ? []
        : (
            await tx
              .select({ id: wakalaTypes.id })
              .from(wakalaTypes)
              .where(
                and(
                  eq(wakalaTypes.workspaceSubdomain, subdomain),
                  inArray(wakalaTypes.mujtahidRepresentativeId, repIds),
                ),
              )
          ).map((row) => row.id);

    const [receipts] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(obligationCollections)
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, subdomain),
          repIds.length > 0
            ? inArray(obligationCollections.mujtahidRepresentativeId, repIds)
            : sql`false`,
        ),
      );

    if (wakalaIds.length === 0) {
      return { wakalaTypes: 0, distributions: 0, receipts: Number(receipts?.count ?? 0) };
    }

    const [rules] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(obligationDistributions)
      .where(
        and(
          eq(obligationDistributions.workspaceSubdomain, subdomain),
          inArray(obligationDistributions.wakalaTypeId, wakalaIds),
        ),
      );
    return {
      wakalaTypes: wakalaIds.length,
      distributions: Number(rules?.count ?? 0),
      receipts: Number(receipts?.count ?? 0),
    };
  });
}
