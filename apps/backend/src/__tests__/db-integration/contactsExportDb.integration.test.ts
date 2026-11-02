import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { buildCsvContent, type Contact } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workspaces } from "../../db/schema.js";
import { listContactsPage } from "../../db/repositories/contactRepositoryList.js";
import { generateCsvStreamChunks } from "../../lib/csvExportStreamFactory.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = `contacts-export-${randomUUID().slice(0, 8)}`;
const CONTACT_COUNT = 300;

/**
 * UUIDv7-shaped, zero-padded ids whose ascending order is the REVERSE of the
 * contact name order. A page walk that accidentally switches to `ORDER BY id`
 * after page 1 therefore drops rows and fails the assertions below.
 */
function contactId(index: number): string {
  return `00000000-0000-7000-8000-${String(CONTACT_COUNT - index).padStart(12, "0")}`;
}

function contactName(index: number): string {
  return `Contact ${String(index).padStart(3, "0")}`;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: `ws-${tenant}`,
      subdomain: tenant,
      madrasaName: "Contacts export paging test",
      enabled: true,
    });
    await tx.insert(contacts).values(
      Array.from({ length: CONTACT_COUNT }, (_, index) => ({
        id: contactId(index),
        workspaceSubdomain: tenant,
        firstName: "Contact",
        lastName: String(index).padStart(3, "0"),
        name: contactName(index),
      })),
    );
  });
});

afterAll(async () => {
  try {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, tenant));
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  } finally {
    await closeDatabase();
  }
});

describe("contacts CSV export over OFFSET pages (Postgres)", () => {
  it("exports all 300 name-sorted contacts without dropping rows after page 1", async () => {
    const generator = generateCsvStreamChunks<Contact, { label: string }>({
      filename: "x.csv",
      chunkSize: 250,
      columns: [{ label: "Name" }],
      loadByIds: async () => [],
      // Mirrors the contacts export page loader: `skipCount` + the caller's
      // sort are forwarded, and the repository only emits `nextCursor` when it
      // is in id-keyset mode (never here), so the walk must stay OFFSET-based.
      loadPage: async (page, limit, afterId) => {
        const pageResult = await listContactsPage(tenant, {
          page,
          limit,
          afterId,
          sortField: "name",
          sortDir: "asc",
          skipCount: true,
          recipientProjection: true,
        });
        return {
          rows: pageResult.contacts,
          hasMore: pageResult.hasMore,
          nextCursor: pageResult.nextCursor,
        };
      },
      yieldDataChunks: function* (rows) {
        yield `\n${buildCsvContent(rows.map((row) => [row.name]))}`;
      },
    });

    const chunks: string[] = [];
    let step = await generator.next();
    while (!step.done) {
      chunks.push(step.value);
      step = await generator.next();
    }
    expect(step.value.count).toBe(CONTACT_COUNT);

    const names = chunks
      .slice(1)
      .join("")
      .trim()
      .split("\n")
      .map((line) => line.slice(1, -1));

    expect(names).toHaveLength(CONTACT_COUNT);
    expect(new Set(names).size).toBe(CONTACT_COUNT);
    for (let i = 1; i < names.length; i += 1) {
      expect(names[i]! >= names[i - 1]!, `row ${i} is out of order`).toBe(true);
    }
  });
});
