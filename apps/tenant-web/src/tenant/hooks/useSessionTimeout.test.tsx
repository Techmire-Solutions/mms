import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useSessionTimeout } from "./useSessionTimeout";
import type { IdleTimerState } from "@mms/fe-core/hooks/useIdleTimer";

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  isExtendingSession: false,
  logout: vi.fn(),
  extendSession: vi.fn<() => Promise<void>>(),
  idleOptions: null as null | Record<string, unknown>,
  idleState: { remainingMs: 42_000, isWarning: true, reset: vi.fn() } as IdleTimerState,
  modalProps: null as null | Record<string, unknown>,
  notifyInfo: vi.fn(),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    logout: mocks.logout,
    extendSession: mocks.extendSession,
    isExtendingSession: mocks.isExtendingSession,
  }),
}));
vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ language: "en", sessionTimeout: "30" }),
}));
vi.mock("@mms/fe-core/hooks/useIdleTimer", () => ({
  useIdleTimer: (options: Record<string, unknown>): IdleTimerState => {
    mocks.idleOptions = options;
    return mocks.idleState;
  },
}));
vi.mock("@/components/app/SessionTimeoutModal", () => ({
  SessionTimeoutModal: (props: Record<string, unknown>) => {
    mocks.modalProps = props;
    return null;
  },
}));
vi.mock("@mms/fe-core/notify", () => ({
  notify: { info: mocks.notifyInfo, error: vi.fn() },
}));

function renderHook() {
  function Harness() {
    // The hook returns the modal element itself — render it so the mock receives props.
    return useSessionTimeout();
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<Harness />);
  });
  return () => act(() => root.unmount());
}

describe("useSessionTimeout", () => {
  beforeEach(() => {
    mocks.isAuthenticated = true;
    mocks.isExtendingSession = false;
    mocks.logout.mockReset();
    mocks.extendSession.mockReset();
    mocks.extendSession.mockResolvedValue(undefined);
    mocks.idleState = { remainingMs: 42_000, isWarning: true, reset: vi.fn() };
    mocks.modalProps = null;
  });

  it("drives the idle timer from the workspace session policy and the session state", () => {
    const unmount = renderHook();

    expect(mocks.idleOptions).toMatchObject({
      enabled: true,
      timeoutMs: 30 * 60_000,
    });
    expect(mocks.idleOptions?.warnBeforeMs).toEqual(expect.any(Number));
    expect(typeof mocks.idleOptions?.onTimeout).toBe("function");
    unmount();
  });

  it("notifies and signs out when the idle deadline expires", () => {
    const unmount = renderHook();

    act(() => {
      (mocks.idleOptions?.onTimeout as () => void)();
    });

    expect(mocks.notifyInfo).toHaveBeenCalledTimes(1);
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("resets the client timer after a session extension, even when the extend call fails", async () => {
    const unmount = renderHook();
    const onExtend = mocks.modalProps?.onExtend as () => void;
    expect(typeof onExtend).toBe("function");

    await act(async () => {
      onExtend();
      await Promise.resolve();
    });
    expect(mocks.idleState.reset as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);

    mocks.extendSession.mockRejectedValue(new Error("network"));
    await act(async () => {
      onExtend();
      await Promise.resolve();
    });
    expect(mocks.idleState.reset as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("wires the warning modal to the idle state and the session extend busy flag", () => {
    mocks.isExtendingSession = true;
    const unmount = renderHook();

    expect(mocks.modalProps).toMatchObject({
      open: true,
      remainingMs: 42_000,
      busy: true,
    });
    expect(typeof mocks.modalProps?.onExtend).toBe("function");
    expect(typeof mocks.modalProps?.onSignOut).toBe("function");
    unmount();
  });
});
