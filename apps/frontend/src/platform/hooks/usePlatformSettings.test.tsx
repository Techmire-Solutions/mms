import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { withQueryClient } from "@/test/queryClientTestUtils";
import {
  useUpdatePlatformSettings,
  useMigrateAndRestartPlatform,
  waitForBackendReadyAfterMigrate,
} from "./usePlatformSettings";
import { PLATFORM_SETTINGS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    updateSettings: vi.fn(),
    migrateAndRestart: vi.fn(),
  },
  health: {
    ready: vi.fn(),
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
vi.mock("./usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({ isPlatformAuthenticated: true, canSettings: true }),
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

describe("usePlatformSettings mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given a 4xx update-settings response, should reject and leave the cached settings intact", async () => {
    // Arrange
    apiContractMock.platform.updateSettings.mockResolvedValue({
      status: 400,
      body: { message: "Invalid setting value", type: "validation_error" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const existing = { emailNotifications: false, smsNotifications: true };
    client.setQueryData(PLATFORM_SETTINGS_QUERY_KEY, existing);
    const { getResult, cleanup } = renderHook(useUpdatePlatformSettings, client);

    // Act / Assert
    await expect(getResult().mutateAsync({ smsNotifications: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Invalid setting value",
    });
    expect(client.getQueryData(PLATFORM_SETTINGS_QUERY_KEY)).toEqual(existing);
    cleanup();
  });

  it("given a 2xx update-settings response, should resolve and refresh the cached settings", async () => {
    // Arrange
    apiContractMock.platform.updateSettings.mockResolvedValue({
      status: 200,
      body: { settings: { smsNotifications: false }, success: true },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(PLATFORM_SETTINGS_QUERY_KEY, { id: "global", emailNotifications: false });
    const { getResult, cleanup } = renderHook(useUpdatePlatformSettings, client);

    // Act
    await getResult().mutateAsync({ smsNotifications: false });

    // Assert
    expect(client.getQueryData(PLATFORM_SETTINGS_QUERY_KEY)).toEqual({ smsNotifications: false });
    cleanup();
  });

  it("given a 4xx migrate-and-restart response, should reject without a success toast", async () => {
    // Arrange
    apiContractMock.platform.migrateAndRestart.mockResolvedValue({
      status: 400,
      body: { message: "Current password is wrong", type: "invalid_current_password" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getResult, cleanup } = renderHook(useMigrateAndRestartPlatform, client);

    // Act / Assert
    await expect(
      getResult().mutateAsync({ confirm: "MIGRATE", password: "wrong" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Current password is wrong",
    });
    expect(notifyMock.success).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("waitForBackendReadyAfterMigrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("given an immediately ready backend, should resolve after the delay window", async () => {
    // Arrange
    apiContractMock.health.ready.mockResolvedValue({ status: 200, body: {} });

    // Act
    const pending = waitForBackendReadyAfterMigrate(0);
    await vi.advanceTimersByTimeAsync(0);

    // Assert
    await expect(pending).resolves.toBeUndefined();
    expect(apiContractMock.health.ready).toHaveBeenCalledTimes(1);
  });

  it("given a restarting backend, should poll /ready until it reports 200", async () => {
    // Arrange
    apiContractMock.health.ready
      .mockResolvedValueOnce({ status: 503, body: { message: "restarting" } })
      .mockResolvedValueOnce({ status: 503, body: { message: "restarting" } })
      .mockResolvedValue({ status: 200, body: {} });

    // Act
    const pending = waitForBackendReadyAfterMigrate(0);
    await vi.advanceTimersByTimeAsync(750);
    await vi.advanceTimersByTimeAsync(750);

    // Assert
    await expect(pending).resolves.toBeUndefined();
    expect(apiContractMock.health.ready).toHaveBeenCalledTimes(3);
  });

  it("given an abort signal fired during the delay, should reject with an AbortError", async () => {
    // Arrange
    const controller = new AbortController();

    // Act
    const pending = waitForBackendReadyAfterMigrate(60_000, controller.signal);
    controller.abort();

    // Assert
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(apiContractMock.health.ready).not.toHaveBeenCalled();
  });

  it("given a backend that never becomes ready, should give up after the poll timeout", async () => {
    // Arrange
    apiContractMock.health.ready.mockResolvedValue({
      status: 503,
      body: { message: "restarting" },
    });

    // Act
    const pending = waitForBackendReadyAfterMigrate(0);
    await vi.advanceTimersByTimeAsync(65_000);

    // Assert
    await expect(pending).resolves.toBeUndefined();
    expect(apiContractMock.health.ready).toHaveBeenCalled();
  });
});
