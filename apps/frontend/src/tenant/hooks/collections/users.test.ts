import { describe, expect, it } from "vitest";
import * as usersFacade from "./users";

describe("users collection facade", () => {
  it("exports expected query keys and helpers", () => {
    expect(usersFacade.USERS_LIST_QUERY_KEY).toBeDefined();
    expect(usersFacade.USERS_METRICS_QUERY_KEY).toBeDefined();
    expect(usersFacade.ACTIVITY_LOGS_QUERY_KEY).toBeDefined();
    expect(typeof usersFacade.extractActivityLogs).toBe("function");
    expect(typeof usersFacade.fetchAllUsersForQuery).toBe("function");
    expect(typeof usersFacade.setUserFieldConfigMemory).toBe("function");
    expect(typeof usersFacade.setUserPreferencesMemory).toBe("function");
    expect(typeof usersFacade.invalidateUsersQueries).toBe("function");
  });

  it("exports all hook functions", () => {
    expect(typeof usersFacade.useUsersByIds).toBe("function");
    expect(typeof usersFacade.useUsersMetrics).toBe("function");
    expect(typeof usersFacade.useActivityLogs).toBe("function");
    expect(typeof usersFacade.useUsersMutations).toBe("function");
    expect(typeof usersFacade.useUsersPaginated).toBe("function");
    expect(typeof usersFacade.useUsersContractList).toBe("function");
    expect(typeof usersFacade.useUsersContractCreate).toBe("function");
    expect(typeof usersFacade.useUsersContractUpdate).toBe("function");
    expect(typeof usersFacade.useUsersContractInvite).toBe("function");
    expect(typeof usersFacade.useUsersContractBulkUpdate).toBe("function");
    expect(typeof usersFacade.useUsersContractBulkDelete).toBe("function");
    expect(typeof usersFacade.useUsersContractBulkRestore).toBe("function");
    expect(typeof usersFacade.useUsersContractDelete).toBe("function");
    expect(typeof usersFacade.useUsersContractRestore).toBe("function");
    expect(typeof usersFacade.useUsersContractVerifyEmail).toBe("function");
  });
});
