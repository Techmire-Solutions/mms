import { describe, expect, it, vi, beforeEach } from "vitest";
import { isBrowserOnTenantHost } from "@/lib/host/tenantHost";
import { getCurrentSubdomain } from "@/lib/config/tenantConfig";

vi.mock("@/lib/config/tenantConfig", () => ({
  getCurrentSubdomain: vi.fn(),
}));

const mockedGetCurrentSubdomain = vi.mocked(getCurrentSubdomain);

describe("isBrowserOnTenantHost", () => {
  beforeEach(() => {
    mockedGetCurrentSubdomain.mockReset();
  });

  it("returns true when a tenant subdomain is present", () => {
    mockedGetCurrentSubdomain.mockReturnValue("al-noor");
    expect(isBrowserOnTenantHost()).toBe(true);
  });

  it("returns false on the platform apex host", () => {
    mockedGetCurrentSubdomain.mockReturnValue(null);
    expect(isBrowserOnTenantHost()).toBe(false);
  });
});
