import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
const initDb = vi.fn().mockResolvedValue(undefined);

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock("../db/dbInit.js", () => ({
  initDb: (...args: unknown[]) => initDb(...args),
}));

vi.mock("../config/loadEnv.js", () => ({
  resolveBackendRoot: () => "/repo/apps/backend",
}));

describe("platformAdminService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    initDb.mockReset().mockResolvedValue(undefined);
    execFileMock.mockReset().mockImplementation((_file, _args, _opts, cb) => {
      if (typeof cb === "function") {
        cb(null, "ok", "");
      }
    });
  });

  afterEach(async () => {
    const { resetMigrateRestartLatchForTests } =
      await import("../services/platform/platformAdminService.js");
    resetMigrateRestartLatchForTests();
    vi.useRealTimers();
  });

  it("isRemoteMigrateRestartEnabled requires explicit env opt-in", async () => {
    delete process.env.PLATFORM_ALLOW_REMOTE_MIGRATE_RESTART;
    const { isRemoteMigrateRestartEnabled } =
      await import("../services/platform/platformAdminService.js");
    expect(isRemoteMigrateRestartEnabled()).toBe(false);

    process.env.PLATFORM_ALLOW_REMOTE_MIGRATE_RESTART = "true";
    expect(isRemoteMigrateRestartEnabled()).toBe(true);
  });

  it("runMigrateAndReload applies initDb then invokes hardcoded pm2 reload", async () => {
    const { runMigrateAndReload } = await import("../services/platform/platformAdminService.js");
    await runMigrateAndReload();

    expect(initDb).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [bin, args, opts] = execFileMock.mock.calls[0] as [
      string,
      string[],
      { cwd: string },
      unknown,
    ];
    expect(bin).toBe("pm2");
    expect(args).toEqual([
      "reload",
      join(resolve("/repo"), "ecosystem.config.cjs"),
      "--only",
      "mmsv2-backend",
      "--update-env",
    ]);
    expect(opts.cwd).toBe(resolve("/repo"));
  });

  it("scheduleMigrateAndRestart rejects a second concurrent schedule", async () => {
    vi.useFakeTimers();
    const { scheduleMigrateAndRestart, isMigrateRestartInFlight } =
      await import("../services/platform/platformAdminService.js");

    const meta = {
      userId: "u1",
      userEmail: "a@b.com",
      ipAddress: "127.0.0.1",
    };
    expect(scheduleMigrateAndRestart(meta)).toBe(true);
    expect(isMigrateRestartInFlight()).toBe(true);
    expect(scheduleMigrateAndRestart(meta)).toBe(false);

    // Do not flush timers — would call process.exit fallback paths in failure cases.
  });

  it("clears in-flight latch when reload is skipped outside production/PM2", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPm2Home = process.env.PM2_HOME;
    const prevPmId = process.env.pm_id;
    delete process.env.PM2_HOME;
    delete process.env.pm_id;
    process.env.NODE_ENV = "test";

    execFileMock.mockImplementation((_file, _args, _opts, cb) => {
      if (typeof cb === "function") {
        cb(new Error("pm2 not found"), "", "");
      }
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const { scheduleMigrateAndRestart, isMigrateRestartInFlight, MIGRATE_RESTART_DELAY_MS } =
      await import("../services/platform/platformAdminService.js");

    vi.useFakeTimers();
    expect(
      scheduleMigrateAndRestart({
        userId: "u_platform_000000000000001",
      }),
    ).toBe(true);
    expect(isMigrateRestartInFlight()).toBe(true);

    await vi.advanceTimersByTimeAsync(MIGRATE_RESTART_DELAY_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(initDb).toHaveBeenCalledTimes(1);
    expect(isMigrateRestartInFlight()).toBe(false);
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
    process.env.NODE_ENV = prevNodeEnv;
    if (prevPm2Home !== undefined) process.env.PM2_HOME = prevPm2Home;
    if (prevPmId !== undefined) process.env.pm_id = prevPmId;
  });

  it("skips process.exit fallback outside production/PM2 when pm2 fails", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevPm2Home = process.env.PM2_HOME;
    const prevPmId = process.env.pm_id;
    delete process.env.PM2_HOME;
    delete process.env.pm_id;
    process.env.NODE_ENV = "test";

    execFileMock.mockImplementation((_file, _args, _opts, cb) => {
      if (typeof cb === "function") {
        cb(new Error("pm2 not found"), "", "");
      }
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const { reloadBackendProcess } = await import("../services/platform/platformAdminService.js");
    const result = await reloadBackendProcess();

    expect(result).toEqual({ reloaded: false });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();

    process.env.NODE_ENV = prevNodeEnv;
    if (prevPm2Home !== undefined) process.env.PM2_HOME = prevPm2Home;
    if (prevPmId !== undefined) process.env.pm_id = prevPmId;
  });
});
