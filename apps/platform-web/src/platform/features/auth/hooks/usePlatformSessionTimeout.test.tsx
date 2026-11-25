import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionTimeoutPolicy } from "@mms/contracts";
import { usePlatformSessionTimeout } from "@/platform/features/auth/hooks/usePlatformSessionTimeout";

const apiContractMock = vi.hoisted(() => ({
  platform: { getSessionPolicy: vi.fn() },
}));

const notifyMock = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

const idleTimerMock = vi.hoisted(() => ({
  options: null as {
    enabled: boolean;
    timeoutMs: number;
    warnBeforeMs?: number;
    onTimeout: () => void;
  } | null,
  reset: vi.fn(),
}));

const modalMock = vi.hoisted(() => ({
  props: null as {
    open: boolean;
    busy: boolean;
    onExtend: () => void;
    onSignOut: () => void;
  } | null,
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/notify", () => ({ notify: notifyMock }));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@mms/fe-core/hooks/useIdleTimer", () => ({
  useIdleTimer: (options: {
    enabled: boolean;
    timeoutMs: number;
    warnBeforeMs?: number;
    onTimeout: () => void;
  }) => {
    idleTimerMock.options = options;
    return { remainingMs: 0, isWarning: false, reset: idleTimerMock.reset };
  },
}));
vi.mock("@/components/app/SessionTimeoutModal", () => ({
  SessionTimeoutModal: (props: {
    open: boolean;
    busy: boolean;
    onExtend: () => void;
    onSignOut: () => void;
  }) => {
    modalMock.props = props;
    return null;
  },
}));

interface PolicyResponse {
  status: number;
  body: SessionTimeoutPolicy;
}

function deferred(): {
  promise: Promise<PolicyResponse>;
  resolve: (value: PolicyResponse) => void;
} {
  let resolve!: (value: PolicyResponse) => void;
  const promise = new Promise<PolicyResponse>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const POLICY: SessionTimeoutPolicy = { idleMs: 300_000, warnBeforeMs: 60_000, absoluteMs: null };

interface ProbeProps {
  enabled: boolean;
  busy?: boolean;
  onTimeout: () => void;
  onExtend: () => Promise<void>;
}

function Probe({ enabled, busy = false, onTimeout, onExtend }: ProbeProps) {
  return usePlatformSessionTimeout({ enabled, onTimeout, onExtend, busy });
}

function renderProbe(props: ProbeProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Probe {...props} />);
  });

  return {
    rerender: (next: ProbeProps) => {
      act(() => {
        root.render(<Probe {...next} />);
      });
    },
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Renders an enabled watcher and resolves the session-policy fetch inside act. */
async function renderArmed(props: Omit<ProbeProps, "enabled"> & { busy?: boolean }) {
  const policyResponse = deferred();
  apiContractMock.platform.getSessionPolicy.mockReturnValue(policyResponse.promise);

  const harness = renderProbe({ enabled: true, ...props });

  await act(async () => {
    policyResponse.resolve({ status: 200, body: POLICY });
  });

  expect(idleTimerMock.options?.enabled).toBe(true);
  return harness;
}

describe("usePlatformSessionTimeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given an authenticated session, should arm the idle clock only after the policy loads", async () => {
    // Arrange
    const policyResponse = deferred();
    apiContractMock.platform.getSessionPolicy.mockReturnValue(policyResponse.promise);
    const { cleanup } = renderProbe({
      enabled: true,
      onTimeout: vi.fn(),
      onExtend: vi.fn().mockResolvedValue(undefined),
    });

    // Assert — not armed while the policy is in flight.
    expect(idleTimerMock.options?.enabled).toBe(false);

    // Act
    await act(async () => {
      policyResponse.resolve({ status: 200, body: POLICY });
    });

    // Assert
    expect(idleTimerMock.options?.enabled).toBe(true);
    expect(idleTimerMock.options?.timeoutMs).toBe(POLICY.idleMs);
    cleanup();
  });

  it("given an extension in flight when the idle deadline fires, should not sign the admin out", async () => {
    // Arrange
    const onTimeout = vi.fn();
    const harness = await renderArmed({
      busy: false,
      onTimeout,
      onExtend: vi.fn().mockResolvedValue(undefined),
    });

    // Act — deadline expires while the extension request is pending.
    harness.rerender({
      enabled: true,
      busy: true,
      onTimeout,
      onExtend: vi.fn().mockResolvedValue(undefined),
    });
    act(() => {
      idleTimerMock.options?.onTimeout();
    });

    // Assert
    expect(onTimeout).not.toHaveBeenCalled();
    expect(notifyMock.info).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("given the idle deadline fires with no extension pending, should sign the admin out", async () => {
    // Arrange
    const onTimeout = vi.fn();
    const { cleanup } = await renderArmed({
      onTimeout,
      onExtend: vi.fn().mockResolvedValue(undefined),
    });

    // Act
    act(() => {
      idleTimerMock.options?.onTimeout();
    });

    // Assert
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("given an explicit sign-out while extending, should sign the admin out immediately", async () => {
    // Arrange
    const onTimeout = vi.fn();
    const { cleanup } = await renderArmed({
      busy: true,
      onTimeout,
      onExtend: vi.fn().mockResolvedValue(undefined),
    });

    // Act
    act(() => {
      modalMock.props?.onSignOut();
    });

    // Assert
    expect(onTimeout).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("given an extension already in flight, should ignore repeated stay-signed-in clicks", async () => {
    // Arrange
    const onExtend = vi.fn().mockResolvedValue(undefined);
    const harness = await renderArmed({ busy: true, onTimeout: vi.fn(), onExtend });

    // Act
    act(() => {
      modalMock.props?.onExtend();
    });
    expect(onExtend).not.toHaveBeenCalled();

    harness.rerender({ enabled: true, busy: false, onTimeout: vi.fn(), onExtend });
    act(() => {
      modalMock.props?.onExtend();
    });

    // Assert
    expect(onExtend).toHaveBeenCalledTimes(1);
    harness.cleanup();
  });

  it("given a failed extension request, should still relax the client idle window", async () => {
    // Arrange
    const { cleanup } = await renderArmed({
      onTimeout: vi.fn(),
      onExtend: vi.fn().mockRejectedValue(new Error("network down")),
    });

    // Act
    await act(async () => {
      modalMock.props?.onExtend();
    });

    // Assert
    expect(idleTimerMock.reset).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
