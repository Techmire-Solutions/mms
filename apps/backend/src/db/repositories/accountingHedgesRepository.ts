import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  HedgeRelationship,
  HedgeRelationshipCreate,
  HedgeStatus,
  HedgeType,
  HedgeValuationRecord,
} from "@mms/shared";
import { accountingHedgeRelationships, accountingHedgeValuations } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { canonicalStoredRate as trimNumeric } from "./repositoryFxMappers.js";

const tenantKey = (tenant: string) => tenant.trim().toLowerCase();

const relationshipColumns = {
  id: accountingHedgeRelationships.id,
  name: accountingHedgeRelationships.name,
  hedgeType: accountingHedgeRelationships.hedgeType,
  direction: accountingHedgeRelationships.direction,
  currency: accountingHedgeRelationships.currency,
  notional: accountingHedgeRelationships.notional,
  contractRate: accountingHedgeRelationships.contractRate,
  designationRate: accountingHedgeRelationships.designationRate,
  designationDate: accountingHedgeRelationships.designationDate,
  maturityDate: accountingHedgeRelationships.maturityDate,
  hedgedItem: accountingHedgeRelationships.hedgedItem,
  riskManagementObjective: accountingHedgeRelationships.riskManagementObjective,
  instrumentAccountId: accountingHedgeRelationships.instrumentAccountId,
  reserveAccountId: accountingHedgeRelationships.reserveAccountId,
  pnlAccountId: accountingHedgeRelationships.pnlAccountId,
  status: accountingHedgeRelationships.status,
  settledReserve: accountingHedgeRelationships.settledReserve,
  createdAt: accountingHedgeRelationships.createdAt,
};

const valuationColumns = {
  relationshipId: accountingHedgeValuations.relationshipId,
  valuationDate: accountingHedgeValuations.valuationDate,
  kind: accountingHedgeValuations.kind,
  rate: accountingHedgeValuations.rate,
  instrumentValue: accountingHedgeValuations.instrumentValue,
  hedgedChange: accountingHedgeValuations.hedgedChange,
  effective: accountingHedgeValuations.effective,
  ineffective: accountingHedgeValuations.ineffective,
  entryId: accountingHedgeValuations.entryId,
  reversalEntryId: accountingHedgeValuations.reversalEntryId,
};

async function hydrate(
  tx: TenantTransaction,
  subdomain: string,
  rows: Awaited<ReturnType<typeof selectRelationships>>,
): Promise<HedgeRelationship[]> {
  if (rows.length === 0) return [];
  const valuations = await tx
    .select(valuationColumns)
    .from(accountingHedgeValuations)
    .where(
      and(
        eq(accountingHedgeValuations.workspaceSubdomain, subdomain),
        inArray(
          accountingHedgeValuations.relationshipId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(
      asc(accountingHedgeValuations.valuationDate),
      asc(accountingHedgeValuations.createdAt),
    );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hedgeType: row.hedgeType as HedgeType,
    direction: row.direction as HedgeRelationship["direction"],
    currency: row.currency,
    notional: trimNumeric(row.notional),
    contractRate: trimNumeric(row.contractRate),
    designationRate: trimNumeric(row.designationRate),
    designationDate: row.designationDate,
    maturityDate: row.maturityDate,
    hedgedItem: row.hedgedItem,
    riskManagementObjective: row.riskManagementObjective,
    instrumentAccountId: row.instrumentAccountId,
    reserveAccountId: row.reserveAccountId,
    pnlAccountId: row.pnlAccountId,
    status: row.status as HedgeStatus,
    settledReserve: trimNumeric(row.settledReserve),
    createdAt: row.createdAt.toISOString(),
    valuations: valuations
      .filter((valuation) => valuation.relationshipId === row.id)
      .map((valuation): HedgeValuationRecord => ({
        valuationDate: valuation.valuationDate,
        kind: valuation.kind as HedgeValuationRecord["kind"],
        rate: trimNumeric(valuation.rate),
        instrumentValue: trimNumeric(valuation.instrumentValue),
        hedgedChange: trimNumeric(valuation.hedgedChange),
        effective: trimNumeric(valuation.effective),
        ineffective: trimNumeric(valuation.ineffective),
        entryId: valuation.entryId,
        reversalEntryId: valuation.reversalEntryId,
      })),
  }));
}

function selectRelationships(tx: TenantTransaction, subdomain: string, id?: string) {
  return tx
    .select(relationshipColumns)
    .from(accountingHedgeRelationships)
    .where(
      id
        ? and(
            eq(accountingHedgeRelationships.workspaceSubdomain, subdomain),
            eq(accountingHedgeRelationships.id, id),
          )
        : eq(accountingHedgeRelationships.workspaceSubdomain, subdomain),
    )
    .orderBy(desc(accountingHedgeRelationships.designationDate))
    .limit(id ? 1 : 200);
}

/** Hedge relationships with their valuation history, newest designation first (bounded to 200). */
export async function listHedgeRelationships(tenant: string): Promise<HedgeRelationship[]> {
  const subdomain = tenantKey(tenant);
  return withTenantRead(subdomain, async (tx) =>
    hydrate(tx, subdomain, await selectRelationships(tx, subdomain)),
  );
}

/** Read-your-writes lookup inside the caller's transaction. */
export async function findHedgeRelationship(
  tenant: string,
  id: string,
): Promise<HedgeRelationship | null> {
  const subdomain = tenantKey(tenant);
  return withTenant(subdomain, async (tx) => {
    const [relationship] = await hydrate(
      tx,
      subdomain,
      await selectRelationships(tx, subdomain, id),
    );
    return relationship ?? null;
  });
}

export async function insertHedgeRelationship(
  tenant: string,
  id: string,
  hedge: HedgeRelationshipCreate,
  userId: string | null,
): Promise<void> {
  const subdomain = tenantKey(tenant);
  await withTenant(subdomain, (tx) =>
    tx
      .insert(accountingHedgeRelationships)
      .values({ id, workspaceSubdomain: subdomain, ...hedge, createdBy: userId }),
  );
}

export async function insertHedgeValuation(
  tenant: string,
  relationshipId: string,
  id: string,
  record: HedgeValuationRecord,
  userId: string | null,
): Promise<void> {
  const subdomain = tenantKey(tenant);
  await withTenant(subdomain, (tx) =>
    tx
      .insert(accountingHedgeValuations)
      .values({ id, workspaceSubdomain: subdomain, relationshipId, ...record, createdBy: userId }),
  );
}

export async function updateHedgeStatus(
  tenant: string,
  id: string,
  status: HedgeStatus,
  settledReserve?: string,
): Promise<void> {
  const subdomain = tenantKey(tenant);
  await withTenant(subdomain, (tx) =>
    tx
      .update(accountingHedgeRelationships)
      .set({
        status,
        updatedAt: new Date(),
        ...(settledReserve === undefined ? {} : { settledReserve }),
      })
      .where(
        and(
          eq(accountingHedgeRelationships.workspaceSubdomain, subdomain),
          eq(accountingHedgeRelationships.id, id),
        ),
      ),
  );
}
