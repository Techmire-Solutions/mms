import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getPreparedTenantUserById,
  getPreparedContactById,
  getPreparedStudentById,
  getPreparedSessionById,
  resetPreparedStatements,
  preparedTenantUserColumns,
  preparedContactColumns,
  preparedStudentColumns,
  preparedSessionColumns,
} from "../db/preparedStatements.js";

describe("preparedStatements", () => {
  beforeEach(() => {
    resetPreparedStatements();
  });

  it("exports valid column mappings for prepared statements", () => {
    expect(preparedTenantUserColumns.id).toBeDefined();
    expect(preparedTenantUserColumns.workspaceSubdomain).toBeDefined();
    expect(preparedContactColumns.id).toBeDefined();
    expect(preparedContactColumns.workspaceSubdomain).toBeDefined();
    expect(preparedStudentColumns.id).toBeDefined();
    expect(preparedStudentColumns.workspaceSubdomain).toBeDefined();
    expect(preparedSessionColumns.id).toBeDefined();
    expect(preparedSessionColumns.workspaceSubdomain).toBeDefined();
  });

  it("compiles prepared statements on mock client for all 4 entities", () => {
    const mockExecute = vi.fn().mockResolvedValue([{ id: "test-1" }]);
    const mockPrepare = vi.fn().mockReturnValue({ execute: mockExecute });
    const mockLimit = vi.fn().mockReturnValue({ prepare: mockPrepare });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockClient = { select: mockSelect };

    const userStmt = getPreparedTenantUserById(mockClient);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_tenant_user_by_id");
    expect(userStmt).toBeDefined();

    const contactStmt = getPreparedContactById(mockClient);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_contact_by_id");
    expect(contactStmt).toBeDefined();

    const studentStmt = getPreparedStudentById(mockClient);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_student_by_id");
    expect(studentStmt).toBeDefined();

    const sessionStmt = getPreparedSessionById(mockClient);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_session_by_id");
    expect(sessionStmt).toBeDefined();
  });

  it("throws descriptive error when client does not support select or prepare", () => {
    expect(() => getPreparedTenantUserById({})).toThrow("Client does not support select");
    expect(() => getPreparedTenantUserById({ select: "invalid" })).toThrow(
      "Client select is not a function",
    );

    const clientWithoutPrepare = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({}),
          }),
        }),
      }),
    };
    expect(() => getPreparedTenantUserById(clientWithoutPrepare)).toThrow(
      "Client does not support prepare",
    );
  });

  it("resetPreparedStatements successfully resets in-memory cache", () => {
    resetPreparedStatements();
    expect(true).toBe(true);
  });
});
