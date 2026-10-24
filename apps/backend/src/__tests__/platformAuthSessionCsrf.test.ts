import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuePlatformSession } from "../services/platform/platformAuthService.js";

const mockSetCsrfCookie = vi.fn();
const mockClearAuthCookies = vi.fn();
const mockSetPlatformAccessCookie = vi.fn();
const mockResetSessionClock = vi.fn();

vi.mock("../services/auth/authCookieService.js", () => ({
  clearAuthCookies: (...args: unknown[]) => mockClearAuthCookies(...args),
  setCsrfCookie: (...args: unknown[]) => mockSetCsrfCookie(...args),
}));

vi.mock("../services/platform/platformCookieService.js", () => ({
  clearPlatformAccessCookie: vi.fn(),
  setPlatformAccessCookie: (...args: unknown[]) => mockSetPlatformAccessCookie(...args),
}));

vi.mock("../services/sessionClockService.js", () => ({
  platformSessionScope: (id: string) => `platform:${id}`,
  resetSessionClock: (...args: unknown[]) => mockResetSessionClock(...args),
}));

vi.mock("../services/sessionPolicyService.js", () => ({
  platformSessionPolicy: () => ({ idleMs: 60_000 }),
}));

vi.mock("../services/platform/platformTwoFactorService.js", () => ({
  createPlatformTwoFactorChallenge: vi.fn(),
  isPlatformTwoFactorRequired: () => false,
}));

vi.mock("../services/platform/platformUserService.js", () => ({
  findPlatformUserByEmail: vi.fn(),
  toPlatformUserProfile: vi.fn(),
  toPublicPlatformUser: vi.fn(),
}));

describe("issuePlatformSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetSessionClock.mockResolvedValue(undefined);
  });

  it("clears tenant cookies then re-issues CSRF for platform mutations", async () => {
    const reply = { setCookie: vi.fn() } as never;
    const jwtSigner = { sign: vi.fn().mockReturnValue("signed.jwt") } as never;

    await issuePlatformSession(
      {
        id: "plat_1",
        email: "ops@example.com",
        name: "Ops",
        role: "super_user",
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
      },
      jwtSigner,
      reply,
      3,
    );

    expect(mockClearAuthCookies).toHaveBeenCalledWith(reply);
    expect(mockSetCsrfCookie).toHaveBeenCalledWith(reply);
    expect(mockSetPlatformAccessCookie).toHaveBeenCalledWith(reply, "signed.jwt");
    expect(mockClearAuthCookies.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetCsrfCookie.mock.invocationCallOrder[0]!,
    );
  });
});
