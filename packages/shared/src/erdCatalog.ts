import {
  ERD_DOMAIN_ATTENDANCE,
  ERD_DOMAIN_ENROLLMENTS,
  ERD_DOMAIN_SESSIONS,
} from "./erdDomainsAcademics.js";
import { ERD_DOMAIN_EXAMINATIONS, ERD_DOMAIN_QUESTION_BANK } from "./erdDomainsAssessments.js";
import { ERD_DOMAIN_HASANAT, ERD_DOMAIN_OBLIGATIONS } from "./erdDomainsFaith.js";
import { ERD_DOMAIN_ACCOUNTING, ERD_DOMAIN_FINANCE } from "./erdDomainsFinance.js";
import {
  ERD_DOMAIN_DASHBOARD,
  ERD_DOMAIN_OUTBOX,
  ERD_DOMAIN_TASKS,
  ERD_DOMAIN_USERS,
} from "./erdDomainsInfra.js";
import {
  ERD_DOMAIN_CHARITY,
  ERD_DOMAIN_INVENTORY,
  ERD_DOMAIN_MESSAGING,
  ERD_DOMAIN_WORKSHOPS,
} from "./erdDomainsOps.js";
import {
  ERD_DOMAIN_CONTACTS,
  ERD_DOMAIN_STUDENTS,
  ERD_DOMAIN_FACULTY,
} from "./erdDomainsPeople.js";
import { ERD_DOMAIN_PLATFORM, ERD_DOMAIN_SYSTEM } from "./erdDomainsPlatform.js";
import type { ErdDomain, ErdDomainId } from "./erdCatalogTypes.js";

export type {
  ErdColumn,
  ErdColumnKind,
  ErdDomain,
  ErdDomainId,
  ErdRelationship,
  ErdTable,
  PlatformErdResponse,
} from "./erdCatalogTypes.js";
export { ERD_DOMAIN_IDS } from "./erdCatalogTypes.js";
export {
  buildErdMermaid,
  filterErdDomainByTable,
  isErdDomainId,
  listErdTableNames,
  mermaidErdToken,
} from "./erdCatalogHelpers.js";

/**
 * Domain-separated ERDs aligned with Drizzle schema modules.
 * Tenant tables share a composite key of `(workspace_subdomain, id)` unless noted.
 */
export const ERD_DOMAINS: readonly ErdDomain[] = [
  ERD_DOMAIN_ACCOUNTING,
  ERD_DOMAIN_ATTENDANCE,
  ERD_DOMAIN_CHARITY,
  ERD_DOMAIN_CONTACTS,
  ERD_DOMAIN_DASHBOARD,
  ERD_DOMAIN_ENROLLMENTS,
  ERD_DOMAIN_EXAMINATIONS,
  ERD_DOMAIN_FACULTY,
  ERD_DOMAIN_FINANCE,
  ERD_DOMAIN_HASANAT,
  ERD_DOMAIN_INVENTORY,
  ERD_DOMAIN_MESSAGING,
  ERD_DOMAIN_OBLIGATIONS,
  ERD_DOMAIN_OUTBOX,
  ERD_DOMAIN_PLATFORM,
  ERD_DOMAIN_QUESTION_BANK,
  ERD_DOMAIN_SESSIONS,
  ERD_DOMAIN_STUDENTS,
  ERD_DOMAIN_SYSTEM,
  ERD_DOMAIN_TASKS,
  ERD_DOMAIN_USERS,
  ERD_DOMAIN_WORKSHOPS,
];

const ERD_DOMAIN_BY_ID = new Map<string, ErdDomain>(
  ERD_DOMAINS.map((domain) => [domain.id, domain]),
);

/** Look up a domain ERD by id. */
export function getErdDomain(id: ErdDomainId | string): ErdDomain {
  const domain = ERD_DOMAIN_BY_ID.get(id);
  if (!domain) {
    throw new Error(`Unknown ERD domain id: ${id}`);
  }
  return domain;
}
