import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  countPlatformActivityLogsOlderThan: vi.fn(),
  deletePlatformActivityLogsOlderThan: vi.fn(),
}));

import {
  countPlatformActivityLogsOlderThan,
  deletePlatformActivityLogsOlderThan,
} from "../db/repositories/platformActivityLogsRepository.js";
import {
  DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
  platformActivityLogCutoff,
  purgeExpiredPlatformActivityLogs,
  resolvePlatformActivityLogRetentionDays,
} from "../worker/purgePlatformActivityLogsJob.js";

const mockedCount = vi.mocked(countPlatformActivityLogsOlderThan);
const mockedDelete = vi.mocked(deletePlatformActivityLogsOlderThan);

describe("purgePlatformActivityLogsJob", () => {
  const previousRetention = process.env.PLATFORM_ACTIVITY_LOG_RETENTION_DAYS;
  const previousDryRun = process.env.DRY_RUN;

  beforeEach(() => {
    mockedCount.mockReset();
    mockedDelete.mockReset();
    delete process.env.PLATFORM_ACTIVITY_LOG_RETENTION_DAYS;
    delete process.env.DRY_RUN;
  });

  afterEach(() => {
    if (previousRetention === undefined) delete process.env.PLATFORM_ACTIVITY_LOG_RETENTION_DAYS;
    else process.env.PLATFORM_ACTIVITY_LOG_RETENTION_DAYS = previousRetention;
    if (previousDryRun === undefined) delete process.env.DRY_RUN;
    else process.env.DRY_RUN = previousDryRun;
  });

  it("defaults retention to 180 days and accepts a positive env override", () => {
    expect(resolvePlatformActivityLogRetentionDays()).toBe(
      DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
    );
    expect(resolvePlatformActivityLogRetentionDays("90")).toBe(90);
    expect(resolvePlatformActivityLogRetentionDays("0")).toBe(
      DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
    );
    expect(resolvePlatformActivityLogRetentionDays("nope")).toBe(
      DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
    );
  });

  it("computes cutoff from retention days", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    const cutoff = platformActivityLogCutoff(now, 180);
    expect(cutoff.toISOString()).toBe("2026-04-08T12:00:00.000Z");
  });

  it("given DRY_RUN, should count expired rows without deleting", async () => {
    mockedCount.mockResolvedValue(42);

    const result = await purgeExpiredPlatformActivityLogs(true);

    expect(result).toEqual({
      deleted: 42,
      dryRun: true,
      retentionDays: DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
    });
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(mockedCount).toHaveBeenCalledOnce();
  });

  it("given live purge, should delete in chunks until a short batch", async () => {
    mockedDelete.mockResolvedValueOnce(500).mockResolvedValueOnce(500).mockResolvedValueOnce(12);

    const result = await purgeExpiredPlatformActivityLogs(false);

    expect(result.deleted).toBe(1012);
    expect(result.dryRun).toBe(false);
    expect(mockedDelete).toHaveBeenCalledTimes(3);
    expect(mockedCount).not.toHaveBeenCalled();
  });
});
