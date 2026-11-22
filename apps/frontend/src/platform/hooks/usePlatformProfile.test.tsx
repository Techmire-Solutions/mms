import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { withQueryClient } from "@/test/queryClientTestUtils";
import { useUpdatePlatformProfileName, useUpdatePlatformPassword } from "./usePlatformProfile";
import { PLATFORM_PROFILE_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    patchMe: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  checkPlatformAuth: vi.fn().mockResolvedValue(undefined),
  isPlatformAuthenticated: true,
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/notify", () => ({ notify: notifyMock }));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/platform/lib/platformAuthErrors", () => ({
  getPlatformErrorMessage: (error: Error) => error.message,
}));
vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    isPlatformAuthenticated: authMock.isPlatformAuthenticated,
    checkPlatformAuth: authMock.checkPlatformAuth,
  }),
}));

function renderHook<T>(hook: () => T, client: QueryClient) {
  let result!: T;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = hook();
    return null;
  }

  act(() => {
    root.render(withQueryClient(<Probe />, client));
  });

  return {
    getResult: () => result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("usePlatformProfile mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.checkPlatformAuth.mockResolvedValue(undefined);
  });

  it("given a 4xx change-password response, should reject instead of resolving success", async () => {
    // Arrange
    apiContractMock.platform.changePassword.mockResolvedValue({
      status: 400,
      body: { message: "Current password is wrong", type: "invalid_current_password" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getResult, cleanup } = renderHook(useUpdatePlatformPassword, client);

    // Act / Assert
    await expect(
      getResult().mutateAsync({ currentPassword: "wrong", newPassword: "Abcdef12345" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Current password is wrong",
    });
    cleanup();
  });

  it("given a 4xx patch-profile response, should reject with the server ApiError message", async () => {
    // Arrange
    apiContractMock.platform.patchMe.mockResolvedValue({
      status: 400,
      body: { message: "Name too short", type: "validation_error" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getResult, cleanup } = renderHook(useUpdatePlatformProfileName, client);

    // Act / Assert
    await expect(getResult().mutateAsync({ name: "x" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Name too short",
    });
    cleanup();
  });

  it("given a 2xx patch-profile response, should update the profile cache and re-check auth", async () => {
    // Arrange
    apiContractMock.platform.patchMe.mockResolvedValue({
      status: 200,
      body: { user: { id: "self", name: "Renamed Operator" } },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(PLATFORM_PROFILE_QUERY_KEY, { id: "self", name: "Old Name" });
    const { getResult, cleanup } = renderHook(useUpdatePlatformProfileName, client);

    // Act
    await getResult().mutateAsync({ name: "Renamed Operator" });

    // Assert
    expect(client.getQueryData(PLATFORM_PROFILE_QUERY_KEY)).toMatchObject({
      id: "self",
      name: "Renamed Operator",
    });
    expect(authMock.checkPlatformAuth).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
