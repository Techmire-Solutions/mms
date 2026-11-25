import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { configureModuleAdapters } from "../bootstrap/configureModuleAdapters.js";
import { registerDefaultBackgroundJobRunners } from "../services/backgroundJobRunnerService.js";

const API_SRC = path.resolve(import.meta.dirname, "..");

describe("worker & migrateDb module adapter wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers all default background job runners after configureModuleAdapters()", () => {
    configureModuleAdapters();
    expect(() => registerDefaultBackgroundJobRunners()).not.toThrow();
  });

  it.each([
    {
      relPath: "worker/index.ts",
      mustPrecede: ["initializeDatabase(", "registerDefaultBackgroundJobRunners("],
    },
    {
      relPath: "worker/processors/sandboxedExportProcessor.ts",
      mustPrecede: ["initializeDatabase(", "registerDefaultBackgroundJobRunners("],
    },
    {
      relPath: "worker/processors/sandboxedPdfProcessor.ts",
      mustPrecede: ["initializeDatabase(", "registerDefaultBackgroundJobRunners("],
    },
    {
      relPath: "scripts/migrateDb.ts",
      mustPrecede: ["initializeDatabase("],
    },
  ])(
    "$relPath invokes configureModuleAdapters() before $mustPrecede",
    ({ relPath, mustPrecede }) => {
      const src = readFileSync(path.join(API_SRC, relPath), "utf8");
      const callIdx = src.indexOf("configureModuleAdapters()");
      expect(callIdx).toBeGreaterThan(-1);
      for (const target of mustPrecede) {
        const targetIdx = src.indexOf(target);
        expect(targetIdx).toBeGreaterThan(-1);
        expect(callIdx).toBeLessThan(targetIdx);
      }
    },
  );

  it.each([
    "scripts/migrateDb.ts",
    "index.ts",
    "worker/index.ts",
    "worker/processors/sandboxedExportProcessor.ts",
    "worker/processors/sandboxedPdfProcessor.ts",
  ])("%s imports preloadEnv.js as its very first import before ESM graph evaluation", (relPath) => {
    const src = readFileSync(path.join(API_SRC, relPath), "utf8");
    const firstImport = src.match(/^\s*import\s+(?:[^'"]*\s+from\s+)?["']([^"']+)["'];?/m);
    expect(firstImport?.[1]).toMatch(/config\/preloadEnv\.js$/);
  });

  it("does not throw on JWT_SECRET when importing db/database in production with only DATABASE_URL set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("PORT", "5002");
    vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:1/mms");
    vi.stubEnv("JWT_SECRET", "");
    await expect(import("../db/database.js")).resolves.toBeDefined();
  });
});
