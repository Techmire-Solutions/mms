import { sql } from "drizzle-orm";
import type { FxRealizedRow } from "@mms/shared";
import { withTenantRead } from "../tenant-context.js";
import { canonicalStoredRate as trimNumeric } from "./repositoryFxMappers.js";

/**
 * Realized FX booked on active payments dated in [from, to], grouped by the
 * invoice currency (a functional-currency payment settling a foreign invoice
 * realizes FX on the invoice's currency).
 */
export async function listRealizedFxByCurrency(tenant: string, from: string, to: string): Promise<FxRealizedRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const { rows } = await tx.execute<{ currency: string; realized: string; payments: string }>(sql`
      SELECT COALESCE(i.currency, p.currency) AS currency,
        SUM(p.realized_fx)::text AS realized, COUNT(*)::text AS payments
      FROM finance_payments p
      JOIN finance_invoices i ON i.workspace_subdomain = p.workspace_subdomain AND i.id = p.invoice_id
      WHERE p.workspace_subdomain = ${subdomain}
        AND p.deleted_at IS NULL AND p.realized_fx IS NOT NULL AND p.realized_fx <> 0
        AND p.date BETWEEN ${from} AND ${to}
      GROUP BY COALESCE(i.currency, p.currency)
      ORDER BY 1`);
    return rows.map((row) => ({
      currency: row.currency,
      realized: trimNumeric(row.realized),
      payments: Number(row.payments),
    }));
  });
}
