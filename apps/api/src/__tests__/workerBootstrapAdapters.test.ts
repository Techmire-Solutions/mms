import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { configureModuleAdapters } from "../bootstrap/configureModuleAdapters.js";
import { registerDefaultBackgroundJobRunners } from "../services/backgroundJobRunnerService.js";

const API_SRC = path.resolve(import.meta.dirname, "..");

describe("worker & migrateDb module adapter wiring", () => {
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
});
