import { describe, expect, it, vi } from "vitest";
import {
  connectClientWithRetry,
  isTransientConnectionError,
  main,
  runRlsRoleCheck,
} from "../scripts/checkRlsRole.js";

describe("checkRlsRole connection retry logic", () => {
  it("identifies transient PostgreSQL errors correctly", () => {
    expect(isTransientConnectionError(new Error("the database system is in recovery mode"))).toBe(
      true,
    );
    expect(
      isTransientConnectionError(new Error("the database system is not yet accepting connections")),
    ).toBe(true);
    expect(isTransientConnectionError(new Error("the database system is starting up"))).toBe(true);
    expect(isTransientConnectionError({ code: "57P03", message: "cannot connect now" })).toBe(true);
    expect(
      isTransientConnectionError({
        code: "ECONNREFUSED",
        message: "connect ECONNREFUSED",
      }),
    ).toBe(true);
    expect(isTransientConnectionError({ code: "ETIMEDOUT", message: "connect ETIMEDOUT" })).toBe(
      true,
    );

    // Non-transient errors should not be treated as transient
    expect(
      isTransientConnectionError(new Error('password authentication failed for user "postgres"')),
    ).toBe(false);
    expect(isTransientConnectionError(new Error('database "mms" does not exist'))).toBe(false);
    expect(isTransientConnectionError(null)).toBe(false);
    expect(isTransientConnectionError(undefined)).toBe(false);
  });

  it("connects immediately on first attempt when database is available", async () => {
    const connectMock = vi.fn().mockResolvedValue(undefined);
    const endMock = vi.fn().mockResolvedValue(undefined);
    const clientFactory = vi.fn().mockReturnValue({
      connect: connectMock,
      end: endMock,
    });

    const client = await connectClientWithRetry("postgres://localhost:5432/mms", {
      maxAttempts: 3,
      delayMs: 10,
      clientFactory,
    });

    expect(client).toBeDefined();
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(endMock).not.toHaveBeenCalled();
  });

  it("retries on transient recovery mode error and succeeds when database becomes ready", async () => {
    let callCount = 0;
    const connectMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("the database system is in recovery mode");
      }
      return undefined;
    });
    const endMock = vi.fn().mockResolvedValue(undefined);
    const clientFactory = vi.fn().mockReturnValue({
      connect: connectMock,
      end: endMock,
    });

    const client = await connectClientWithRetry("postgres://localhost:5432/mms", {
      maxAttempts: 5,
      delayMs: 5,
      clientFactory,
    });

    expect(client).toBeDefined();
    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(endMock).toHaveBeenCalledTimes(2);
  });

  it("fails immediately without retrying on fatal non-transient errors", async () => {
    const connectMock = vi
      .fn()
      .mockRejectedValue(new Error('password authentication failed for user "postgres"'));
    const endMock = vi.fn().mockResolvedValue(undefined);
    const clientFactory = vi.fn().mockReturnValue({
      connect: connectMock,
      end: endMock,
    });

    await expect(
      connectClientWithRetry("postgres://localhost:5432/mms", {
        maxAttempts: 5,
        delayMs: 5,
        clientFactory,
      }),
    ).rejects.toThrow('password authentication failed for user "postgres"');

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting max attempts if database remains in recovery mode", async () => {
    const connectMock = vi
      .fn()
      .mockRejectedValue(new Error("the database system is in recovery mode"));
    const endMock = vi.fn().mockResolvedValue(undefined);
    const clientFactory = vi.fn().mockReturnValue({
      connect: connectMock,
      end: endMock,
    });

    await expect(
      connectClientWithRetry("postgres://localhost:5432/mms", {
        maxAttempts: 3,
        delayMs: 5,
        clientFactory,
      }),
    ).rejects.toThrow("the database system is in recovery mode");

    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(endMock).toHaveBeenCalledTimes(3);
  });
});

describe("runRlsRoleCheck logic", () => {
  it("returns exit code 1 when DATABASE_URL is missing", async () => {
    const prevUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const code = await runRlsRoleCheck();
      expect(code).toBe(1);
    } finally {
      if (prevUrl) process.env.DATABASE_URL = prevUrl;
    }
  });

  it("returns exit code 0 when role satisfies RLS in strict mode", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ role: "mms_app", is_superuser: false, bypass_rls: false }],
    });
    const endMock = vi.fn().mockResolvedValue(undefined);

    const code = await runRlsRoleCheck({
      connectionString: "postgres://localhost:5432/mms",
      mode: "strict",
      client: { query: queryMock, end: endMock },
    });

    expect(code).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 0 when role bypasses RLS but mode is warn", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ role: "postgres", is_superuser: true, bypass_rls: true }],
    });
    const endMock = vi.fn().mockResolvedValue(undefined);

    const code = await runRlsRoleCheck({
      connectionString: "postgres://localhost:5432/mms",
      mode: "warn",
      client: { query: queryMock, end: endMock },
    });

    expect(code).toBe(0);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 1 when role bypasses RLS and mode is strict", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ role: "postgres", is_superuser: true, bypass_rls: true }],
    });
    const endMock = vi.fn().mockResolvedValue(undefined);

    const code = await runRlsRoleCheck({
      connectionString: "postgres://localhost:5432/mms",
      mode: "strict",
      client: { query: queryMock, end: endMock },
    });

    expect(code).toBe(1);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("supports JSON output format", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ role: "mms_app", is_superuser: false, bypass_rls: false }],
    });
    const endMock = vi.fn().mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = await runRlsRoleCheck({
        connectionString: "postgres://localhost:5432/mms",
        mode: "strict",
        json: true,
        client: { query: queryMock, end: endMock },
      });

      expect(code).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("throws when query returns no row", async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const endMock = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRlsRoleCheck({
        connectionString: "postgres://localhost:5432/mms",
        mode: "strict",
        client: { query: queryMock, end: endMock },
      }),
    ).rejects.toThrow("could not resolve current_user from pg_roles");

    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("main sets process.exitCode when check fails", async () => {
    const prevUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const prevExitCode = process.exitCode;
    try {
      await main();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExitCode;
      if (prevUrl) process.env.DATABASE_URL = prevUrl;
    }
  });
});
