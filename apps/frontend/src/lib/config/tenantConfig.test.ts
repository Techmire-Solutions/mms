import { describe, expect, it, afterEach } from "vitest";
import {
  getCurrentSubdomain,
  isCurrentHostApex,
  tenantUrl,
  apexUrl,
} from "@/lib/config/tenantConfig";

function setHostname(hostname: string): void {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, hostname, protocol: "https:", port: "" },
  });
}

describe("config/tenantConfig", () => {
  afterEach(() => {
    setHostname("localhost");
  });

  it("getCurrentSubdomain returns null on the apex host", () => {
    setHostname("localhost");
    expect(getCurrentSubdomain()).toBeNull();
  });

  it("isCurrentHostApex returns true on the apex host", () => {
    setHostname("localhost");
    expect(isCurrentHostApex()).toBe(true);
  });

  it("tenantUrl builds a subdomain URL", () => {
    setHostname("localhost");
    const url = tenantUrl("al-noor", "/students");
    expect(url).toContain("al-noor");
    expect(url).toContain("/students");
  });

  it("apexUrl builds an apex URL", () => {
    setHostname("localhost");
    const url = apexUrl("/settings");
    expect(url).toContain("/settings");
  });
});
