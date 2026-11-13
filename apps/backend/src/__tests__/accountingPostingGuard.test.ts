import { describe, expect, it, vi, beforeEach } from "vitest";
import type { JournalEntry, User, WorkspaceRole } from "@mms/shared";
import { assertEntriesPostable } from "../accounting/use-cases/accountingPostingGuard.js";
import { setUserRoleCatalog } from "../lib/userPermissionContext.js";

/**
 * Draft ⇄ posted boundary.
 *
 * `accounting.write` drafts; `accounting.post` makes the voucher immutable. The
 * gate runs on the entries bulk route (`beforeSave`), which is the only write path
 * a browser has for vouchers, so a Junior Accountant custom role cannot post by
 * sending `status: "posted"` directly.
 */

const user = (role: string): User => ({ id: "u-1", role, workspaceSubdomain: "demo" }) as User;
const senior = user("accountant");

/** A custom role with `accounting` create/update but no post. */
const juniorRole: WorkspaceRole = {
  id: "junior_accountant_c1",
  labelKey: "nav.accounting",
  descriptionKey: "nav.accounting",
  isSystem: false,
  badgeVariant: "primary" as const,
  permissions: { accounting: ["read", "create", "update"] },
};
const seniorRole: WorkspaceRole = {
  id: "senior_accountant_c1",
  labelKey: "nav.accounting",
  descriptionKey: "nav.accounting",
  isSystem: false,
  badgeVariant: "primary" as const,
  permissions: { accounting: ["read", "create", "update", "post"] },
};

/** A user whose custom role catalog is attached the way auth middleware does it. */
const withRoles = (role: string, catalog: readonly WorkspaceRole[]): User => {
  const actor = { id: "u-1", role, workspaceSubdomain: "demo" } as User;
  setUserRoleCatalog(actor, catalog);
  return actor;
};

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry =>
  ({
    id: "je-1",
    date: "2026-06-01",
    ref: "JV-1",
    description: "Tuition",
    status: "posted",
    created_by: "u-1",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines: [
      { id: "l1", account_id: "cash", debit: 100, credit: 0, description: "" },
      { id: "l2", account_id: "fees", debit: 0, credit: 100, description: "" },
    ],
    ...overrides,
  }) as JournalEntry;

describe("assertEntriesPostable", () => {
  const loadStored = vi.fn();

  beforeEach(() => {
    loadStored.mockReset().mockResolvedValue(null);
  });

  it("allows drafting without posting authority", async () => {
    await expect(
      assertEntriesPostable(
        withRoles(juniorRole.id, [juniorRole]),
        [entry({ status: "draft" })],
        loadStored,
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a posted voucher from a draft-only role, with a stable code", async () => {
    await expect(
      assertEntriesPostable(withRoles(juniorRole.id, [juniorRole]), [entry()], loadStored),
    ).rejects.toMatchObject({
      statusCode: 403,
      type: "forbidden",
      code: "accounting.post.required",
    });
  });

  it("refuses promoting an existing draft for a draft-only role", async () => {
    loadStored.mockResolvedValue(entry({ status: "draft" }));

    await expect(
      assertEntriesPostable(withRoles(juniorRole.id, [juniorRole]), [entry()], loadStored),
    ).rejects.toMatchObject({ statusCode: 403, code: "accounting.post.required" });
  });

  it("allows an unchanged re-save of an already-posted voucher", async () => {
    // The bulk upsert re-sends the page it read; that must not require posting.
    loadStored.mockResolvedValue(entry());

    await expect(
      assertEntriesPostable(withRoles(juniorRole.id, [juniorRole]), [entry()], loadStored),
    ).resolves.toBeUndefined();
  });

  it("allows posting for a role holding accounting.post", async () => {
    await expect(
      assertEntriesPostable(withRoles(seniorRole.id, [seniorRole]), [entry()], loadStored),
    ).resolves.toBeUndefined();
  });

  it("keeps the built-in accountant posting (unchanged default behaviour)", async () => {
    await expect(assertEntriesPostable(senior, [entry()], loadStored)).resolves.toBeUndefined();
  });
});
