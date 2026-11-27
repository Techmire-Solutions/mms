import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { ROUTES } from "@/lib/config/routes";
import { usePlatformForgotPasswordController } from "./usePlatformForgotPasswordController";

const navigateMock = vi.fn();
const checkPlatformAuthMock = vi.fn();
const forgotMutateMock = vi.fn();
const resetMutateMock = vi.fn();
const resendMutateMock = vi.fn();
const focusAuthFieldMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [mockSearchParams],
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.code ? `${key}:${params.code}:${params.resetId}` : key,
  }),
}));

vi.mock("@/platform/features/auth/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ checkPlatformAuth: checkPlatformAuthMock }),
}));

vi.mock("@/platform/features/auth/hooks/usePlatformAuthActions", () => ({
  usePlatformPasswordForgot: () => ({ isPending: false, mutateAsync: forgotMutateMock }),
  usePlatformPasswordReset: () => ({ isPending: false, mutateAsync: resetMutateMock }),
  usePlatformPasswordResetResend: () => ({ isPending: false, mutateAsync: resendMutateMock }),
}));

vi.mock("@/components/entry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/entry")>();
  return {
    ...actual,
    focusAuthField: (...args: unknown[]) => focusAuthFieldMock(...args),
  };
});

function renderController() {
  let result!: ReturnType<typeof usePlatformForgotPasswordController>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe() {
    result = usePlatformForgotPasswordController();
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  return {
    getResult: () => result,
    rerender: () => {
      act(() => {
        root.render(<Probe />);
      });
    },
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const fakeFormEvent = (): React.FormEvent =>
  ({ preventDefault: vi.fn() }) as unknown as React.FormEvent;

describe("usePlatformForgotPasswordController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("validates email on request, handles devReset hint, and surfaces request errors", async () => {
    const { getResult, cleanup } = renderController();
    expect(getResult().forgotTitle).toBe("platform.forgotTitle");
    expect(getResult().resetPath("id 1")).toBe(`${ROUTES.platformForgotPassword}?resetId=id%201`);

    await act(async () => {
      await getResult().handleRequest(fakeFormEvent());
    });
    expect(getResult().emailError).toBeDefined();
    expect(focusAuthFieldMock).toHaveBeenCalledWith(getResult().emailFieldId);

    forgotMutateMock.mockResolvedValueOnce({});
    act(() => getResult().setEmail("admin@example.com"));
    await act(async () => {
      await getResult().handleRequest(fakeFormEvent());
    });
    expect(getResult().sent).toBe(true);
    expect(getResult().forgotTitle).toBe("auth.forgotCheckEmail");

    forgotMutateMock.mockResolvedValueOnce({
      devReset: { code: "654321", resetId: "rst-dev" },
    });
    await act(async () => {
      await getResult().handleRequest(fakeFormEvent());
    });
    expect(getResult().isResetStep).toBe(true);
    expect(getResult().devHint).toContain("654321");
    expect(getResult().forgotTitle).toBe("platform.forgotResetTitle");

    forgotMutateMock.mockRejectedValueOnce(new Error("Rate limited"));
    await act(async () => {
      await getResult().handleRequest(fakeFormEvent());
    });
    expect(getResult().error).toBeTruthy();
    cleanup();
  });

  it("validates password/OTP on reset, completes reset, and clears state on invalid_reset", async () => {
    mockSearchParams = new URLSearchParams("resetId=rst-99");
    const { getResult, cleanup } = renderController();
    expect(getResult().isResetStep).toBe(true);

    act(() => {
      getResult().setPassword("StrongPass123!");
      getResult().setConfirmPassword("Mismatch123!");
    });
    await act(async () => {
      await getResult().handleReset(fakeFormEvent());
    });
    expect(getResult().error).toBeTruthy();

    act(() => {
      getResult().setPassword("short");
      getResult().setConfirmPassword("short");
    });
    await act(async () => {
      await getResult().handleReset(fakeFormEvent());
    });
    expect(getResult().error).toBeTruthy();

    act(() => {
      getResult().setPassword("StrongPass123!");
      getResult().setConfirmPassword("StrongPass123!");
    });
    await act(async () => {
      await getResult().handleReset(fakeFormEvent());
    });
    expect(getResult().error).toBe("auth.otpIncomplete");

    resetMutateMock.mockResolvedValueOnce({});
    checkPlatformAuthMock.mockResolvedValueOnce(undefined);
    act(() => {
      getResult().setCode(["1", "2", "3", "4", "5", "6"]);
    });
    await act(async () => {
      await getResult().handleReset(fakeFormEvent());
    });
    expect(resetMutateMock).toHaveBeenCalledWith({
      resetId: "rst-99",
      code: "123456",
      password: "StrongPass123!",
    });
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.home, { replace: true });

    resetMutateMock.mockRejectedValueOnce(new ApiError(400, "Expired", "invalid_reset"));
    await act(async () => {
      await getResult().handleReset(fakeFormEvent());
    });
    expect(getResult().isResetStep).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.platformForgotPassword, { replace: true });
    cleanup();
  });

  it("adopts dynamic URL resetId, enforces resend countdown, and handles resend errors", async () => {
    vi.useFakeTimers();
    const { getResult, rerender, cleanup } = renderController();

    mockSearchParams = new URLSearchParams("resetId=rst-url");
    rerender();
    expect(getResult().resetId).toBe("rst-url");

    await act(async () => {
      await getResult().handleResend();
    });
    expect(resendMutateMock).not.toHaveBeenCalled();

    for (let tick = 0; tick < 30; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    expect(getResult().resendCountdown).toBe(0);

    resendMutateMock.mockResolvedValueOnce({
      devReset: { code: "111222", resetId: "rst-url" },
    });
    await act(async () => {
      await getResult().handleResend();
    });
    expect(resendMutateMock).toHaveBeenCalledWith("rst-url");
    expect(getResult().devHint).toContain("111222");

    for (let tick = 0; tick < 30; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    resendMutateMock.mockRejectedValueOnce(new ApiError(429, "Too many", "too_many_attempts"));
    await act(async () => {
      await getResult().handleResend();
    });
    expect(getResult().resetId).toBe("");
    cleanup();
  });
});
