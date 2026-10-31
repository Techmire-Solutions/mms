import { sql } from "drizzle-orm";
import { fxReferenceRates } from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";

interface ReferenceRateSnapshot {
  provider: string;
  baseCurrency: string;
  rateDate: string;
  rates: ReadonlyMap<string, string>;
}

/**
 * Idempotently store one provider fixing in the platform-wide reference table
 * (no tenant column: every workspace reads the same feed). Returns rows written.
 */
export async function upsertReferenceRates(snapshot: ReferenceRateSnapshot): Promise<number> {
  const rows = [...snapshot.rates]
    .filter(([quote]) => quote !== snapshot.baseCurrency)
    .map(([quoteCurrency, rate]) => ({
      provider: snapshot.provider,
      baseCurrency: snapshot.baseCurrency,
      quoteCurrency,
      rateDate: snapshot.rateDate,
      rate,
    }));
  if (rows.length === 0) return 0;
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(fxReferenceRates)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          fxReferenceRates.provider,
          fxReferenceRates.baseCurrency,
          fxReferenceRates.quoteCurrency,
          fxReferenceRates.rateDate,
        ],
        set: { rate: sql`excluded.rate`, fetchedAt: new Date() },
      });
  });
  return rows.length;
}
