import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CONTACTS_QUERY_KEY } from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { hideContactsInListCaches } from "@/tenant/features/contacts/hooks/contactsOptimisticHide";

const contractKey = [...CONTACTS_QUERY_KEY, "contract-list", { page: 1 }];
const rawKey = [...CONTACTS_QUERY_KEY, "paginated", { page: 1 }];
const detailKey = [...CONTACTS_QUERY_KEY, "detail", "a"];

function seed(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(contractKey, {
    status: 200,
    body: { contacts: [{ id: "a" }, { id: "b" }, { id: "c" }], total: 3, page: 1 },
  });
  client.setQueryData(rawKey, { contacts: [{ id: "a" }, { id: 7 }], total: 2 });
  client.setQueryData(detailKey, { contact: { id: "a" } });
  return client;
}

describe("hideContactsInListCaches", () => {
  it("removes the ids from every cached list page and adjusts totals", async () => {
    const client = seed();
    await hideContactsInListCaches(client, ["a", 7]);

    expect(client.getQueryData(contractKey)).toEqual({
      status: 200,
      body: { contacts: [{ id: "b" }, { id: "c" }], total: 2, page: 1 },
    });
    expect(client.getQueryData(rawKey)).toEqual({ contacts: [], total: 0 });
    expect(client.getQueryData(detailKey)).toEqual({ contact: { id: "a" } });
  });

  it("restores the exact snapshots on rollback", async () => {
    const client = seed();
    const before = client.getQueryData(contractKey);
    const rollback = await hideContactsInListCaches(client, ["b"]);
    expect(client.getQueryData(contractKey)).not.toEqual(before);

    rollback();
    expect(client.getQueryData(contractKey)).toEqual(before);
  });
});
