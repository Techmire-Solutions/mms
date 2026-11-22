import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS } from "@mms/shared";
import { withQueryClient } from "@/test/queryClientTestUtils";
import { useAddPlatformAdmin } from "./usePlatformAdmins";
import {
  useSetPlatformAdminDisabled,
  useDeletePlatformAdmin,
  useVerifyPlatformAdminEmail,
} from "./usePlatformAdminLifecycle";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    createAdmin: vi.fn(),
    setAdminDisabled: vi.fn(),
    deleteAdmin: vi.fn(),
    verifyAdminEmail: vi.fn(),
  },
}));

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
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
  usePlatformAuth: () => ({ platformUser: null, checkPlatformAuth: vi.fn() }),
}));
vi.mock("./usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({ canAdmins: true }),
}));

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

describe("platform admin mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given a 4xx create-admin response, should reject without a success toast", async () => {
    // Arrange
    apiContractMock.platform.createAdmin.mockResolvedValue({
      status: 400,
      body: { message: "Email already registered", type: "email_taken" },
    });
    const { getResult, cleanup } = renderHook(useAddPlatformAdmin);

    // Act / Assert
    await expect(
      getResult().mutateAsync({
        name: "Operator",
        email: "operator@example.com",
        password: "Abcdef12345",
        currentPassword: "SuperSecret123",
        permissions: DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400, message: "Email already registered" });
    expect(notifyMock.success).not.toHaveBeenCalled();
    cleanup();
  });

  it("given a 4xx disable-admin response, should reject without a success toast", async () => {
    // Arrange
    apiContractMock.platform.setAdminDisabled.mockResolvedValue({
      status: 400,
      body: { message: "Current password is wrong", type: "invalid_current_password" },
    });
    const { getResult, cleanup } = renderHook(useSetPlatformAdminDisabled);

    // Act / Assert
    await expect(
      getResult().mutateAsync({ adminId: "admin-1", disabled: true, password: "wrong" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Current password is wrong",
    });
    expect(notifyMock.success).not.toHaveBeenCalled();
    cleanup();
  });

  it("given a 2xx disable-admin response, should resolve and toast the disable success", async () => {
    // Arrange
    apiContractMock.platform.setAdminDisabled.mockResolvedValue({
      status: 200,
      body: { user: { id: "admin-1" } },
    });
    const { getResult, cleanup } = renderHook(useSetPlatformAdminDisabled);

    // Act
    await getResult().mutateAsync({ adminId: "admin-1", disabled: true, password: "secret" });

    // Assert
    expect(notifyMock.success).toHaveBeenCalledWith("platform.disableAdminSuccess");
    cleanup();
  });

  it("given a 4xx delete-admin response, should reject without a success toast", async () => {
    // Arrange
    apiContractMock.platform.deleteAdmin.mockResolvedValue({
      status: 403,
      body: { message: "Cannot delete the last super-user", type: "forbidden" },
    });
    const { getResult, cleanup } = renderHook(useDeletePlatformAdmin);

    // Act / Assert
    await expect(
      getResult().mutateAsync({ adminId: "admin-1", password: "secret" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Cannot delete the last super-user",
    });
    expect(notifyMock.success).not.toHaveBeenCalled();
    cleanup();
  });

  it("given a 4xx verify-email response, should reject without a success toast", async () => {
    // Arrange
    apiContractMock.platform.verifyAdminEmail.mockResolvedValue({
      status: 404,
      body: { message: "Admin not found", type: "not_found" },
    });
    const { getResult, cleanup } = renderHook(useVerifyPlatformAdminEmail);

    // Act / Assert
    await expect(getResult().mutateAsync("admin-missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Admin not found",
    });
    expect(notifyMock.success).not.toHaveBeenCalled();
    cleanup();
  });
});
