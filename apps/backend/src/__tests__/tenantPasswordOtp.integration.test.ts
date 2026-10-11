import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi
    .fn()
    .mockImplementation(async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
      callback({} as any),
    ),
}));

const { mockRequest, mockVerify, mockReset, MockTenantPasswordOtpError } = vi.hoisted(() => {
  class HoistedTenantPasswordOtpError extends Error {
    readonly statusCode: number;
    constructor(
      readonly code: "invalid_code" | "too_many_attempts" | "not_found",
      message: string,
    ) {
      super(message);
      this.statusCode = code === "not_found" ? 404 : 400;
    }
  }
  return {
    mockRequest: vi.fn(),
    mockVerify: vi.fn(),
    mockReset: vi.fn(),
    MockTenantPasswordOtpError: HoistedTenantPasswordOtpError,
  };
});

vi.mock("../services/auth/tenantPasswordOtpService.js", () => ({
  requestTenantPasswordReset: (...args: unknown[]) => mockRequest(...args),
  verifyTenantPasswordResetOtp: (...args: unknown[]) => mockVerify(...args),
  resetTenantPassword: (...args: unknown[]) => mockReset(...args),
  TenantPasswordOtpError: MockTenantPasswordOtpError,
}));

describe("tenant forgot-password / activation OTP routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockRequest.mockReset();
    mockVerify.mockReset();
    mockReset.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/auth/forgot-password always accepts (non-enumerating)", async () => {
    mockRequest.mockResolvedValue({ accepted: true });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "nobody@test.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: true });
    await app.close();
  });

  it("POST /api/auth/forgot-password rejects a missing email before calling the service", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(mockRequest).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/auth/forgot-password/verify succeeds for a valid code", async () => {
    mockVerify.mockResolvedValue({ ok: true });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "123456" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it("POST /api/auth/forgot-password/verify surfaces an invalid code as 400", async () => {
    mockVerify.mockRejectedValue(
      new MockTenantPasswordOtpError("invalid_code", "Invalid or expired code"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "000000" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "invalid_code" });
    await app.close();
  });

  it("POST /api/auth/forgot-password/verify surfaces too_many_attempts", async () => {
    mockVerify.mockRejectedValue(
      new MockTenantPasswordOtpError(
        "too_many_attempts",
        "Too many invalid attempts. Request a new code.",
      ),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/verify",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "000000" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "too_many_attempts" });
    await app.close();
  });

  it("POST /api/auth/forgot-password/reset sets the password and establishes a session", async () => {
    mockReset.mockImplementation(async (input: any) => {
      input.reply.setCookie("mms_access", "signed-token", { path: "/" });
      return { user: { id: "u-new", email: "user@test.com", role: "teacher" } };
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "123456", password: "CorrectHorseBattery9!" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { id: "u-new", email: "user@test.com", role: "teacher" } });
    expect(res.cookies.some((cookie) => cookie.name === "mms_access")).toBe(true);
    await app.close();
  });

  it("POST /api/auth/forgot-password/reset rejects a missing password before calling the service", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "123456", password: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockReset).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/auth/forgot-password/reset surfaces an invalid code as 400", async () => {
    mockReset.mockRejectedValue(
      new MockTenantPasswordOtpError("invalid_code", "Invalid or expired code"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password/reset",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { email: "user@test.com", code: "000000", password: "CorrectHorseBattery9!" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "invalid_code" });
    await app.close();
  });
});
