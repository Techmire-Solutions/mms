import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContactsPageUrl,
  contactsListQueryKeyParams,
  contactsPaginatedQueryKey,
  fetchContactById,
  sameContactsListFilters,
  type ContactsPaginatedParams,
} from "@/tenant/features/contacts/hooks/contactsListQueryBuilders";

const apiContractMock = vi.hoisted(() => ({
  contacts: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  apiContract: apiContractMock,
}));

const base: ContactsPaginatedParams = { page: 1 };

describe("buildContactsPageUrl", () => {
  it("builds the base contacts URL with default page size", () => {
    expect(buildContactsPageUrl({ page: 3 })).toBe("/api/contacts?page=3&limit=50");
  });

  it("appends every optional filter", () => {
    const url = buildContactsPageUrl({
      page: 2,
      limit: 50,
      search: "  ali  ",
      gender: "male",
      includeDeleted: true,
      hasPhone: true,
      hasReachable: true,
      quickFilter: "whatsapp",
      excludeIds: ["1", 2],
      excludeLinkedModules: ["students", "faculty"],
      sortField: "name",
      sortDir: "desc",
    });
    expect(url).toBe(
      "/api/contacts?page=2&limit=50&search=ali&gender=male&includeDeleted=true&hasPhone=true&hasReachable=true&quickFilter=whatsapp&excludeIds=1%2C2&excludeLinkedModules=students%2Cfaculty&sortField=name&sortDir=desc",
    );
  });

  it("omits quickFilter 'all' and empty search", () => {
    const url = buildContactsPageUrl({ page: 1, quickFilter: "all", search: "   " });
    expect(url).toBe("/api/contacts?page=1&limit=50");
  });
});

describe("contactsListQueryKeyParams", () => {
  it("normalizes defaults", () => {
    expect(contactsListQueryKeyParams({ page: 1 })).toEqual({
      page: 1,
      limit: 50,
      search: "",
      gender: "",
      includeDeleted: false,
      hasPhone: false,
      hasReachable: false,
      quickFilter: "all",
      excludeIds: "",
      excludeLinkedModules: "",
      sortField: "",
      sortDir: "asc",
    });
  });

  it("serializes arrays and trims search", () => {
    const params = contactsListQueryKeyParams({
      page: 2,
      search: "  zain  ",
      excludeIds: [1, "b"],
      excludeLinkedModules: ["faculty"],
      sortDir: "desc",
    });
    expect(params.search).toBe("zain");
    expect(params.excludeIds).toBe("1,b");
    expect(params.excludeLinkedModules).toBe("faculty");
    expect(params.sortDir).toBe("desc");
  });
});

describe("contactsPaginatedQueryKey", () => {
  it("is a tuple prefixed by the contacts query key", () => {
    const key = contactsPaginatedQueryKey({ page: 1 });
    expect(key).toBeInstanceOf(Array);
    expect(key[0]).toBe("contacts");
    expect(key[1]).toBe("list");
    expect(key[2]).toBe("page");
    expect(key[3]).toMatchObject({ page: 1 });
  });
});

describe("sameContactsListFilters", () => {
  it("returns false for undefined previous", () => {
    expect(sameContactsListFilters(undefined, contactsListQueryKeyParams(base))).toBe(false);
  });

  it("returns true for identical params", () => {
    const params = contactsListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameContactsListFilters(params, contactsListQueryKeyParams({ page: 1, search: "a" })),
    ).toBe(true);
  });

  it("returns false when a filter differs", () => {
    const params = contactsListQueryKeyParams({ page: 1, search: "a" });
    expect(
      sameContactsListFilters(params, contactsListQueryKeyParams({ page: 1, search: "b" })),
    ).toBe(false);
  });
});

describe("fetchContactById", () => {
  beforeEach(() => {
    apiContractMock.contacts.get.mockReset();
  });

  it("should fetch a contact by id", async () => {
    apiContractMock.contacts.get.mockResolvedValue({
      status: 200,
      body: { contact: { id: 7, name: "Seven" } },
    });
    const contact = await fetchContactById("7");
    expect(apiContractMock.contacts.get).toHaveBeenCalledWith({ params: { id: "7" } });
    expect(contact).toEqual({ id: 7, name: "Seven" });
  });
});
