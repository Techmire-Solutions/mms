import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/tenant/pages/auth/Login", () => ({
  default: () => null,
}));

describe("preloadLogin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips fire-and-forget preloading under test mode so Vitest worker teardown never races", async () => {
    const { preloadLoginOnEntryBoot } = await import("./preloadLogin");
    expect(() => preloadLoginOnEntryBoot()).not.toThrow();
  });

  it("resolves the cached Login module promise under production mode", async () => {
    vi.stubEnv("MODE", "production");
    const { loadLoginPage, preloadLoginOnEntryBoot } = await import("./preloadLogin");
    preloadLoginOnEntryBoot();
    const mod = await loadLoginPage();
    expect(mod.default).toBeTypeOf("function");
  });
});
