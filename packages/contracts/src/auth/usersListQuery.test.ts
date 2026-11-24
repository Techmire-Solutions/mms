import { describe, expect, it } from "vitest";
import { paginateUsers, userMatchesSearch, usersListQuerySchema } from "./usersListQuery.js";
import type { WorkspaceUser } from "./userEntityTypes.js";

const sampleUsers: WorkspaceUser[] = [
  {
    id: "1",
    name: "Alice Admin",
    email: "alice@example.com",
    phone: "",
    role: "admin",
    status: "active",
    twoFactorEnabled: true,
    lastLogin: "",
    createdDate: "2024-01-01",
    failedLoginAttempts: 0,
    activeSessions: 1,
    avatarInitials: "AA",
  },
  {
    id: "2",
    name: "Bob Teacher",
    email: "bob@example.com",
    phone: "",
    role: "teacher",
    status: "suspended",
    twoFactorEnabled: false,
    lastLogin: "",
    createdDate: "2024-02-01",
    failedLoginAttempts: 0,
    activeSessions: 0,
    avatarInitials: "BT",
  },
];

describe("usersListQuery", () => {
  it("matches search on name and email", () => {
    expect(userMatchesSearch(sampleUsers[0], "alice")).toBe(true);
    expect(userMatchesSearch(sampleUsers[1], "bob@example.com")).toBe(true);
    expect(userMatchesSearch(sampleUsers[0], "missing")).toBe(false);
  });

  it("paginates with role and status filters", () => {
    const page = paginateUsers(sampleUsers, {
      page: 1,
      limit: 10,
      role: "teacher",
      status: "suspended",
    });
    expect(page.total).toBe(1);
    expect(page.users[0]?.id).toBe("2");
  });

  it("filters a bounded user lookup by ids", () => {
    const query = usersListQuerySchema.parse({ ids: "2,missing", page: "1", limit: "50" });
    const page = paginateUsers(sampleUsers, {
      ids: query.ids,
      page: query.page,
      limit: query.limit,
    });

    expect(page.total).toBe(1);
    expect(page.users.map((user) => user.id)).toEqual(["2"]);
  });
});
