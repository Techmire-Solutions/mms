import { describe, expect, it } from "vitest";
import {
  inferAppDomainFromHostname,
  isOriginAllowedForAppDomain,
  isTrustedWorkspaceOrigin,
  misconfiguredAppDomainHint,
  isHostAllowedForAppDomain,
  parseTenantFromHost,
  resolveAppDomain,
  resolveAppDomainForRequest,
} from "./tenantUtils.js";

const PLATFORM = "platform.example.com";

describe("inferAppDomainFromHostname", () => {
  it("returns localhost for dev hosts", () => {
    expect(inferAppDomainFromHostname("localhost")).toBe("localhost");
    expect(inferAppDomainFromHostname("dar-ul-quran.localhost")).toBe("localhost");
    expect(inferAppDomainFromHostname("127.0.0.1")).toBe("localhost");
  });

  it("returns apex for platform host", () => {
    expect(inferAppDomainFromHostname(PLATFORM)).toBe(PLATFORM);
    expect(inferAppDomainFromHostname(`www.${PLATFORM}`)).toBe(PLATFORM);
  });

  it("returns apex for tenant hosts", () => {
    expect(inferAppDomainFromHostname(`dar-ul-quran.${PLATFORM}`)).toBe(PLATFORM);
    expect(inferAppDomainFromHostname("dar-ul-quran.example.com")).toBe("example.com");
  });

  it("returns apex for mmsv2.aabtaab.com (3-part platform host)", () => {
    expect(inferAppDomainFromHostname("mmsv2.aabtaab.com")).toBe("mmsv2.aabtaab.com");
    expect(inferAppDomainFromHostname("dar-ul-quran.mmsv2.aabtaab.com")).toBe("mmsv2.aabtaab.com");
  });
});

describe("resolveAppDomain", () => {
  it("prefers configured domain", () => {
    expect(resolveAppDomain(`dar-ul-quran.${PLATFORM}`, "custom.example.com")).toBe(
      "custom.example.com",
    );
  });

  it("infers apex from tenant hostname when env is unset", () => {
    const domain = resolveAppDomain(`dar-ul-quran.${PLATFORM}`);
    expect(domain).toBe(PLATFORM);
    expect(parseTenantFromHost(`dar-ul-quran.${PLATFORM}`, domain)).toBe("dar-ul-quran");
    expect(parseTenantFromHost(PLATFORM, domain)).toBeNull();
  });

  it("falls back to localhost when host cannot be inferred", () => {
    expect(resolveAppDomain("")).toBe("localhost");
  });
});

describe("misconfiguredAppDomainHint", () => {
  it("detects when platform host is misread as tenant", () => {
    const hint = misconfiguredAppDomainHint("mmsv2.aabtaab.com", "aabtaab.com");
    expect(hint).toMatch(/Set MMS_APP_DOMAIN=mmsv2\.aabtaab\.com/);
  });

  it("returns null when configured domain matches host", () => {
    expect(misconfiguredAppDomainHint("mmsv2.aabtaab.com", "mmsv2.aabtaab.com")).toBeNull();
  });

  it("returns null for valid madrasa tenant under correct apex", () => {
    expect(
      misconfiguredAppDomainHint("dar-ul-quran.mmsv2.aabtaab.com", "mmsv2.aabtaab.com"),
    ).toBeNull();
  });
});

describe("resolveAppDomainForRequest", () => {
  it("self-corrects short MMS_APP_DOMAIN for platform host", () => {
    expect(resolveAppDomainForRequest("mmsv2.aabtaab.com", "aabtaab.com")).toBe(
      "mmsv2.aabtaab.com",
    );
    expect(parseTenantFromHost("mmsv2.aabtaab.com", "mmsv2.aabtaab.com")).toBeNull();
  });

  it("keeps configured apex for madrasa tenant hosts", () => {
    expect(resolveAppDomainForRequest("dar-ul-quran.mmsv2.aabtaab.com", "mmsv2.aabtaab.com")).toBe(
      "mmsv2.aabtaab.com",
    );
    expect(parseTenantFromHost("dar-ul-quran.mmsv2.aabtaab.com", "mmsv2.aabtaab.com")).toBe(
      "dar-ul-quran",
    );
  });

  it("self-corrects short MMS_APP_DOMAIN for madrasa tenant hosts", () => {
    expect(resolveAppDomainForRequest("dar-ul-quran.mmsv2.aabtaab.com", "aabtaab.com")).toBe(
      "mmsv2.aabtaab.com",
    );
    expect(
      parseTenantFromHost(
        "dar-ul-quran.mmsv2.aabtaab.com",
        resolveAppDomainForRequest("dar-ul-quran.mmsv2.aabtaab.com", "aabtaab.com"),
      ),
    ).toBe("dar-ul-quran");
  });

  it("does not self-correct localhost tenant hosts", () => {
    expect(resolveAppDomainForRequest("najafi.localhost", "localhost")).toBe("localhost");
    expect(resolveAppDomainForRequest("najafi.mms.localhost", "mms.localhost")).toBe(
      "mms.localhost",
    );
  });
});

describe("isHostAllowedForAppDomain", () => {
  const domain = "mmsv2.aabtaab.com";

  it("allows apex and tenants only", () => {
    expect(isHostAllowedForAppDomain("mmsv2.aabtaab.com", domain)).toBe(true);
    expect(isHostAllowedForAppDomain("dar-ul-quran.mmsv2.aabtaab.com", domain)).toBe(true);
    expect(isHostAllowedForAppDomain("aabtaab.com", domain)).toBe(false);
    expect(isHostAllowedForAppDomain("darulquran.pk", domain)).toBe(false);
  });
});

describe("isTrustedWorkspaceOrigin", () => {
  it("allows localhost dev origins only", () => {
    expect(isTrustedWorkspaceOrigin("http://localhost:5173")).toBe(true);
    expect(isTrustedWorkspaceOrigin("http://dar-ul-quran.localhost:5173")).toBe(true);
    expect(isTrustedWorkspaceOrigin(`https://${PLATFORM}`)).toBe(false);
  });
});

describe("isOriginAllowedForAppDomain", () => {
  it("allows apex and tenant origins for the configured domain", () => {
    expect(isOriginAllowedForAppDomain(`https://${PLATFORM}`, PLATFORM)).toBe(true);
    expect(isOriginAllowedForAppDomain(`https://dar-ul-quran.${PLATFORM}`, PLATFORM)).toBe(true);
    expect(isOriginAllowedForAppDomain("https://evil.example.net", PLATFORM)).toBe(false);
  });
});
