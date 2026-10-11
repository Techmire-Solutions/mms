import { sql } from "drizzle-orm";
import {
  type Transaction,
  type ContactChildMaps,
  createEmptyContactChildMaps,
} from "./contactRepositoryHydrateTypes.js";
import {
  buildPhonesAggSql,
  buildEmailsAggSql,
  buildAddressesAggSql,
  buildTagsAggSql,
  assignPersonalChildRows,
} from "./contactHydratePersonalSql.js";
import {
  buildSocialsAggSql,
  buildEducationsAggSql,
  buildExperiencesAggSql,
  buildSkillsAggSql,
  assignProfessionalChildRows,
} from "./contactHydrateProfessionalSql.js";
import {
  buildRelationshipsAggSql,
  buildActivitiesAggSql,
  buildAttachmentsAggSql,
  buildBankDetailsAggSql,
  assignEngagementChildRows,
} from "./contactHydrateEngagementSql.js";

export * from "./contactRepositoryHydrateTypes.js";
export * from "./contactRepositoryHydrateSummaryChildren.js";

export async function loadContactChildMaps(
  tx: Transaction,
  subdomain: string,
  contactIds: string[],
): Promise<ContactChildMaps> {
  if (contactIds.length === 0) {
    return createEmptyContactChildMaps();
  }

  const BATCH_SIZE = 250;
  if (contactIds.length > BATCH_SIZE) {
    const combined = createEmptyContactChildMaps();
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const slice = contactIds.slice(i, i + BATCH_SIZE);
      const partial = await loadContactChildMaps(tx, subdomain, slice);
      for (const [k, v] of partial.phonesMap) combined.phonesMap.set(k, v);
      for (const [k, v] of partial.emailsMap) combined.emailsMap.set(k, v);
      for (const [k, v] of partial.addressesMap) combined.addressesMap.set(k, v);
      for (const [k, v] of partial.tagsMap) combined.tagsMap.set(k, v);
      for (const [k, v] of partial.socialsMap) combined.socialsMap.set(k, v);
      for (const [k, v] of partial.educationsMap) combined.educationsMap.set(k, v);
      for (const [k, v] of partial.experiencesMap) combined.experiencesMap.set(k, v);
      for (const [k, v] of partial.skillsMap) combined.skillsMap.set(k, v);
      for (const [k, v] of partial.relationshipsMap) combined.relationshipsMap.set(k, v);
      for (const [k, v] of partial.activitiesMap) combined.activitiesMap.set(k, v);
      for (const [k, v] of partial.attachmentsMap) combined.attachmentsMap.set(k, v);
      for (const [k, v] of partial.bankDetailsMap) combined.bankDetailsMap.set(k, v);
    }
    return combined;
  }

  return loadContactChildMapsAggregated(tx, subdomain, contactIds);
}

/**
 * Consolidated O(1) SQL query aggregating all 12 contact child collections via json_agg.
 * Eliminates round-trips and connection concurrency load on hot read paths.
 */
export async function loadContactChildMapsAggregated(
  tx: Transaction,
  subdomain: string,
  contactIds: string[],
): Promise<ContactChildMaps> {
  if (contactIds.length === 0) {
    return createEmptyContactChildMaps();
  }

  const result = createEmptyContactChildMaps();

  const queryResult = await tx.execute(sql`
    SELECT
      c.id AS "contactId",
      ${buildPhonesAggSql(subdomain)},
      ${buildEmailsAggSql(subdomain)},
      ${buildAddressesAggSql(subdomain)},
      ${buildTagsAggSql(subdomain)},
      ${buildSocialsAggSql(subdomain)},
      ${buildEducationsAggSql(subdomain)},
      ${buildExperiencesAggSql(subdomain)},
      ${buildSkillsAggSql(subdomain)},
      ${buildRelationshipsAggSql(subdomain)},
      ${buildActivitiesAggSql(subdomain)},
      ${buildAttachmentsAggSql(subdomain)},
      ${buildBankDetailsAggSql(subdomain)}
    FROM (VALUES ${sql.join(
      contactIds.map((id) => sql`(${id}::text)`),
      sql`, `,
    )}) AS c(id)
  `);

  const rows = (
    Array.isArray(queryResult)
      ? queryResult
      : ((queryResult as { rows?: Record<string, unknown>[] })?.rows ?? [])
  ) as Record<string, unknown>[];
  for (const row of rows) {
    const contactId = String(row.contactId);
    assignPersonalChildRows(result, contactId, row);
    assignProfessionalChildRows(result, contactId, row);
    assignEngagementChildRows(result, contactId, row);
  }

  return result;
}
