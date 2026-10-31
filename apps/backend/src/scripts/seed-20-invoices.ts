import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { workspaces } from "../db/schema.js";
import { bulkSaveInvoices } from "../db/repositories/financeInvoicesRepository.js";
import type { Invoice } from "@mms/shared";

loadBackendEnv();

/**
 * Seeds 20 deterministic invoices into a tenant so the a11y gate can audit a *populated* finance
 * Work table — the empty-tenant blind spot in `docs/a11y-baseline.md`. Self-contained:
 * `finance_invoices.student_id` is a plain varchar (no FK), so no other seed needs to run first.
 * Idempotent (fixed ids `inv-seed-*`).
 */
const INVOICE_COUNT = 20;
const STATUSES = ["pending", "paid", "overdue", "partial"] as const;

async function main() {
  await initDb();
  const db = getDb();

  const argSubdomain = process.argv[2]?.trim().toLowerCase();
  let subdomainsToSeed: string[];

  if (argSubdomain && argSubdomain !== "all") {
    subdomainsToSeed = [argSubdomain];
  } else {
    const allWorkspaces = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);
    subdomainsToSeed = Array.from(new Set(allWorkspaces.map((w) => w.subdomain)));
  }

  for (const subdomain of subdomainsToSeed) {
    console.log(`Seeding ${INVOICE_COUNT} dummy invoices for tenant subdomain: "${subdomain}"...`);

    const records: Invoice[] = Array.from({ length: INVOICE_COUNT }, (_, index) => {
      const n = index + 1;
      const base = 1000 + n * 50;
      const status = STATUSES[n % STATUSES.length] ?? "pending";
      return {
        id: `inv-seed-${n}`,
        studentId: `s-seed-dummy-${n}`,
        studentName: `Seeded Student ${String(n).padStart(2, "0")}`,
        class: "Seeded Class",
        session: "Seeded Session",
        baseFee: base,
        discountValue: 0,
        discountAmt: 0,
        finalAmt: base,
        status,
        // Only overdue invoices are past due; the rest keep a future due date so
        // the Outstanding and Overdue dashboard widgets show different cohorts.
        dueDate: status === "overdue" ? "2026-03-31" : "2026-12-31",
        paidAmt: status === "paid" ? base : 0,
        invoiceNumber: `INV-SEED-${String(n).padStart(4, "0")}`,
        billingPeriod: "2026-01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    await bulkSaveInvoices(subdomain, records);
    console.log(`Successfully seeded ${INVOICE_COUNT} invoices into workspace "${subdomain}"!`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed invoices:", err);
  process.exit(1);
});
