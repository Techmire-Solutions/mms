import { eq } from "drizzle-orm";
import type { CurrencyExchangeability, CurrencyExchangeabilityPut } from "@mms/shared";
import { accountingCurrencyExchangeability } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";

const columns = {
  currency: accountingCurrencyExchangeability.currency,
  assessedOn: accountingCurrencyExchangeability.assessedOn,
  estimationMethod: accountingCurrencyExchangeability.estimationMethod,
  reason: accountingCurrencyExchangeability.reason,
  updatedAt: accountingCurrencyExchangeability.updatedAt,
};

/** Non-exchangeable currency → the date from which it is treated as such. */
export async function nonExchangeableSinceInTx(
  tx: TenantTransaction,
  subdomain: string,
): Promise<Map<string, string>> {
  const rows = await tx
    .select({ currency: columns.currency, assessedOn: columns.assessedOn })
    .from(accountingCurrencyExchangeability)
    .where(eq(accountingCurrencyExchangeability.workspaceSubdomain, subdomain));
  return new Map(rows.map((row) => [row.currency, row.assessedOn]));
}

export async function listCurrencyExchangeability(tenant: string): Promise<CurrencyExchangeability[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(columns)
      .from(accountingCurrencyExchangeability)
      .where(eq(accountingCurrencyExchangeability.workspaceSubdomain, subdomain))
      .orderBy(accountingCurrencyExchangeability.currency);
    return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  });
}

/** Replace the assessments (owned rows of the workspace's currency policy). */
export async function saveCurrencyExchangeability(
  tenant: string,
  input: CurrencyExchangeabilityPut,
  userId: string | null,
): Promise<CurrencyExchangeability[]> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(accountingCurrencyExchangeability)
      .where(eq(accountingCurrencyExchangeability.workspaceSubdomain, subdomain));
    if (input.currencies.length > 0) {
      await tx.insert(accountingCurrencyExchangeability).values(
        input.currencies.map((row) => ({
          workspaceSubdomain: subdomain,
          currency: row.currency,
          assessedOn: row.assessedOn,
          estimationMethod: row.estimationMethod,
          reason: row.reason,
          updatedBy: userId,
        })),
      );
    }
  });
  return listCurrencyExchangeability(subdomain);
}
