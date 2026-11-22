import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/test/queryClientTestUtils";
import {
  usePlatformSetupRegister,
  usePlatformPasswordForgot,
  usePlatformPasswordReset,
  usePlatformPasswordResetResend,
} from "./usePlatformAuthActions";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    setupRegister: vi.fn(),
    passwordForgot: vi.fn(),
    passwordReset: vi.fn(),
    passwordResend: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));

function renderHook<T>(hook: () => T) {
  let result!: T;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = hook();
    return null;
  }

  act(() => {
    root.render(withQueryClient(<Probe />));
  });

  return {
    getResult: () => result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("usePlatformAuthActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given a 4xx setup-register response, should reject with the server ApiError instead of resolving", async () => {
    // Arrange
    apiContractMock.platform.setupRegister.mockResolvedValue({
      status: 400,
      body: { message: "Email already registered", type: "email_taken" },
    });
    const { getResult, cleanup } = renderHook(usePlatformSetupRegister);

    // Act / Assert
    await expect(
      getResult().mutateAsync({
        name: "Admin",
        email: "admin@example.com",
        password: "Abcdef12345",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400, message: "Email already registered" });
    cleanup();
  });

  it("given a 2xx setup-register response, should resolve with the result body", async () => {
    // Arrange
    apiContractMock.platform.setupRegister.mockResolvedValue({
      status: 200,
      body: { setupId: "setup-12345678" },
    });
    const { getResult, cleanup } = renderHook(usePlatformSetupRegister);

    // Act / Assert
    await expect(
      getResult().mutateAsync({
        name: "Admin",
        email: "admin@example.com",
        password: "Abcdef12345",
      }),
    ).resolves.toEqual({ setupId: "setup-12345678" });
    cleanup();
  });

  it("given a 4xx forgot-password response, should reject with the server ApiError", async () => {
    // Arrange
    apiContractMock.platform.passwordForgot.mockResolvedValue({
      status: 404,
      body: { message: "No admin with that email", type: "not_found" },
    });
    const { getResult, cleanup } = renderHook(usePlatformPasswordForgot);

    // Act / Assert
    await expect(getResult().mutateAsync({ email: "admin@example.com" })).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "No admin with that email",
    });
    cleanup();
  });

  it("given a 4xx password-reset response, should reject with the server ApiError", async () => {
    // Arrange
    apiContractMock.platform.passwordReset.mockResolvedValue({
      status: 400,
      body: { message: "Reset code expired", type: "code_expired" },
    });
    const { getResult, cleanup } = renderHook(usePlatformPasswordReset);

    // Act / Assert
    await expect(
      getResult().mutateAsync({
        resetId: "reset-12345678",
        code: "1234",
        password: "Abcdef12345",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400, message: "Reset code expired" });
    cleanup();
  });

  it("given a 4xx reset-resend response, should reject with the server ApiError", async () => {
    // Arrange
    apiContractMock.platform.passwordResend.mockResolvedValue({
      status: 400,
      body: { message: "Reset already used", type: "already_used" },
    });
    const { getResult, cleanup } = renderHook(usePlatformPasswordResetResend);

    // Act / Assert
    await expect(getResult().mutateAsync("reset-12345678")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Reset already used",
    });
    cleanup();
  });
});
