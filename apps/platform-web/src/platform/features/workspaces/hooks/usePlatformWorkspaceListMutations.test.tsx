import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { PlatformWorkspaceRow } from "@mms/contracts";
import { withQueryClient } from "@/test/queryClientTestUtils";
import { ApiError } from "@/lib/apiClient";
import { PLATFORM_WORKSPACES_QUERY_KEY } from "@/platform/features/shell/lib/platformQueryKeys";
import { updateWorkspacesCache } from "./platformWorkspacesCache";
import {
  useDeleteWorkspace,
  useRenameWorkspace,
  useSetWorkspaceEmailVerification,
  useSetWorkspaceEnabled,
} from "./usePlatformWorkspaceListMutations";
import { usePlatformWorkspaces } from "./usePlatformWorkspaces";
import { useWorkspaceDeleteState } from "./useWorkspaceDeleteState";

const apiContractMock = vi.hoisted(() => ({
  platform: {
    listWorkspaces: vi.fn(),
    patchWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    patchWorkspaceEmailVerification: vi.fn(),
  },
}));

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/notify", () => ({ notify: notifyMock }));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/platform/features/auth/lib/platformAuthErrors", () => ({
  getPlatformErrorMessage: (error: Error, _t: unknown, _m?: unknown, fallback?: string) =>
    error.message || fallback || "err",
}));
vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({ isPlatformAuthenticated: true, canWorkspaces: true }),
}));

const WORKSPACE: PlatformWorkspaceRow = {
  subdomain: "alnoor",
  madrasaName: "Al Noor",
  enabled: true,
  requireEmailVerification: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  adminEmail: "admin@alnoor.org",
};

function renderHook<T>(hook: () => T, client?: QueryClient) {
  let result!: T;
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = hook();
    return null;
  }

  act(() => {
    root.render(withQueryClient(<Probe />, qc));
  });

  return {
    client: qc,
    getResult: () => result,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("updateWorkspacesCache", () => {
  it("patches ts-rest body, plain object, array, and ignores unrelated shapes", () => {
    expect(updateWorkspacesCache(null, "alnoor", { enabled: false })).toBeNull();
    expect(updateWorkspacesCache({ foo: 1 }, "alnoor", { enabled: false })).toEqual({ foo: 1 });
    expect(
      updateWorkspacesCache({ body: { workspaces: [WORKSPACE] } }, "alnoor", { enabled: false }),
    ).toEqual({ body: { workspaces: [{ ...WORKSPACE, enabled: false }] } });
    expect(
      updateWorkspacesCache({ workspaces: [WORKSPACE] }, "alnoor", { enabled: false }),
    ).toEqual({ workspaces: [{ ...WORKSPACE, enabled: false }] });
    expect(updateWorkspacesCache([WORKSPACE], "alnoor", { enabled: false })).toEqual([
      { ...WORKSPACE, enabled: false },
    ]);
  });
});

describe("usePlatformWorkspaces and list mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads paginated workspace directory with filters", async () => {
    apiContractMock.platform.listWorkspaces.mockResolvedValue({
      status: 200,
      body: { workspaces: [WORKSPACE], total: 1, page: 2, pageSize: 10 },
    });
    const { getResult, cleanup } = renderHook(() =>
      usePlatformWorkspaces({
        page: 2,
        limit: 10,
        search: " noor ",
        status: "active",
        sortField: "name",
        sortDir: "desc",
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      }),
    );

    await vi.waitFor(() => expect(getResult().data).toEqual([WORKSPACE]));
    expect(getResult().total).toBe(1);
    cleanup();
  });

  it("optimistically toggles workspace enabled and rolls back on 4xx", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = [...PLATFORM_WORKSPACES_QUERY_KEY, "list"];
    client.setQueryData(queryKey, { workspaces: [WORKSPACE] });

    apiContractMock.platform.patchWorkspace.mockResolvedValueOnce({
      status: 200,
      body: { workspace: { ...WORKSPACE, enabled: false } },
    });
    const { getResult, cleanup } = renderHook(useSetWorkspaceEnabled, client);

    await act(async () => {
      await getResult().mutateAsync({ subdomain: "alnoor", enabled: false });
    });
    expect(notifyMock.success).toHaveBeenCalledWith("platform.workspaceDisabledToast", {
      description: "alnoor",
    });

    client.setQueryData(queryKey, { workspaces: [WORKSPACE] });
    apiContractMock.platform.patchWorkspace.mockResolvedValueOnce({
      status: 400,
      body: { message: "Cannot toggle" },
    });
    await expect(getResult().mutateAsync({ subdomain: "alnoor", enabled: false })).rejects.toThrow(
      "Cannot toggle",
    );
    expect(client.getQueryData(queryKey)).toEqual({ workspaces: [WORKSPACE] });
    expect(notifyMock.error).toHaveBeenCalledWith("Cannot toggle");
    cleanup();
  });

  it("renames, deletes, and toggles email verification with error handling", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = [...PLATFORM_WORKSPACES_QUERY_KEY, "list"];
    client.setQueryData(queryKey, { workspaces: [WORKSPACE] });

    const rename = renderHook(useRenameWorkspace, client);
    apiContractMock.platform.renameWorkspace.mockResolvedValueOnce({
      status: 200,
      body: { workspace: { ...WORKSPACE, madrasaName: "Al Noor Academy" } },
    });
    await rename.getResult().mutateAsync({ subdomain: "alnoor", madrasaName: "Al Noor Academy" });
    expect(notifyMock.success).toHaveBeenCalledWith("platform.workspaceRenamedToast", {
      description: "Al Noor Academy",
    });

    apiContractMock.platform.renameWorkspace.mockResolvedValueOnce({ status: 400, body: {} });
    await expect(
      rename.getResult().mutateAsync({ subdomain: "alnoor", madrasaName: "Bad" }),
    ).rejects.toThrow("platform.renameFailed");
    rename.cleanup();

    const del = renderHook(useDeleteWorkspace, client);
    apiContractMock.platform.deleteWorkspace.mockResolvedValueOnce({
      status: 403,
      body: { message: "Wrong password", type: "invalid_current_password" },
    });
    await expect(
      del.getResult().mutateAsync({
        subdomain: "alnoor",
        password: "bad",
        confirmSubdomain: "alnoor",
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(notifyMock.error).not.toHaveBeenCalledWith("Wrong password");

    apiContractMock.platform.deleteWorkspace.mockResolvedValueOnce({
      status: 200,
      body: { deleted: true, subdomain: "alnoor" },
    });
    await del.getResult().mutateAsync({
      subdomain: "alnoor",
      password: "ok",
      confirmSubdomain: "alnoor",
    });
    expect(notifyMock.success).toHaveBeenCalledWith("platform.workspaceDeletedToast", {
      description: "alnoor",
    });
    del.cleanup();

    const emailVerif = renderHook(useSetWorkspaceEmailVerification, client);
    apiContractMock.platform.patchWorkspaceEmailVerification.mockResolvedValueOnce({
      status: 200,
      body: { success: true, subdomain: "alnoor", requireEmailVerification: true },
    });
    await emailVerif
      .getResult()
      .mutateAsync({ subdomain: "alnoor", requireEmailVerification: true });
    expect(notifyMock.success).toHaveBeenCalledWith("platform.emailVerificationRequiredToast", {
      description: "alnoor",
    });

    apiContractMock.platform.patchWorkspaceEmailVerification.mockResolvedValueOnce({
      status: 500,
      body: {},
    });
    await expect(
      emailVerif.getResult().mutateAsync({ subdomain: "alnoor", requireEmailVerification: false }),
    ).rejects.toThrow("platform.emailVerificationToggleFailed");
    emailVerif.cleanup();
  });

  it("manages workspace delete confirmation state and resets secrets when closed", async () => {
    apiContractMock.platform.deleteWorkspace
      .mockResolvedValueOnce({
        status: 403,
        body: { message: "Wrong password", type: "invalid_current_password" },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { deleted: true, subdomain: "alnoor" },
      });

    const { getResult, cleanup } = renderHook(useWorkspaceDeleteState);
    act(() => getResult().handleOpenDelete(WORKSPACE));
    expect(getResult().confirmOpen).toBe(true);

    act(() => {
      getResult().setConfirmSubdomain("wrong");
    });
    act(() => getResult().handleDelete());
    expect(getResult().passwordError).toBe("platform.deleteWorkspaceConfirmSubdomainMismatch");

    act(() => {
      getResult().setConfirmSubdomain("ALNOOR");
    });
    act(() => getResult().handleDelete());
    expect(getResult().passwordError).toBe("platform.deleteWorkspacePasswordHint");

    act(() => {
      getResult().setPassword("secret-pass");
    });
    await act(async () => {
      getResult().handleDelete();
    });
    await vi.waitFor(() => expect(getResult().passwordError).toBe("Wrong password"));

    await act(async () => {
      getResult().handleDelete();
    });
    await vi.waitFor(() => expect(getResult().confirmOpen).toBe(false));
    expect(getResult().targetWorkspace).toBeNull();
    expect(getResult().password).toBe("");
    cleanup();
  });
});
