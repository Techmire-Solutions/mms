import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlatformNotificationAck } from "@/platform/hooks/usePlatformNotificationAck";

const authMock = vi.hoisted(() => ({
  userId: null as string | null,
}));

vi.mock("@/platform/features/auth/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ platformUser: { id: authMock.userId } }),
}));

let hookResult: ReturnType<typeof usePlatformNotificationAck> | null = null;

function Probe({ userId }: { userId: string | null }) {
  authMock.userId = userId;
  hookResult = usePlatformNotificationAck();
  return null;
}

function renderProbe(userId: string | null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Probe userId={userId} />);
  });

  return {
    rerender: (nextUserId: string | null) => {
      act(() => {
        root.render(<Probe userId={nextUserId} />);
      });
    },
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
      hookResult = null;
    },
  };
}

describe("usePlatformNotificationAck", () => {
  beforeEach(() => {
    localStorage.clear();
    authMock.userId = null;
  });

  it("given two admins on one device, should keep each admin's acks in a separate key", () => {
    // Arrange
    const harness = renderProbe("user-a");

    // Act
    act(() => {
      hookResult?.ackAll(["n1", "n2"]);
    });
    harness.rerender("user-b");

    // Assert
    expect(JSON.parse(localStorage.getItem("mms_platform_notif_ack_u:user-a") ?? "[]")).toEqual([
      "n1",
      "n2",
    ]);
    expect(hookResult?.ackedIds.has("n1")).toBe(false);
    expect(localStorage.getItem("mms_platform_notif_ack")).toBeNull();
    harness.cleanup();
  });

  it("given a stored set for the signed-in admin, should hydrate from that admin's key", () => {
    // Arrange
    localStorage.setItem("mms_platform_notif_ack_u:user-a", JSON.stringify(["n3"]));

    // Act
    const harness = renderProbe("user-a");

    // Assert
    expect(hookResult?.ackedIds.has("n3")).toBe(true);
    harness.cleanup();
  });

  it("given no signed-in platform user, should keep acks in memory and write nothing", () => {
    // Arrange
    const harness = renderProbe(null);

    // Act
    act(() => {
      hookResult?.ackAll(["n4"]);
    });

    // Assert
    expect(hookResult?.ackedIds.has("n4")).toBe(true);
    expect(localStorage.length).toBe(0);
    harness.cleanup();
  });

  it("given an admin switch, should re-read the new admin's key instead of leaking the old set", () => {
    // Arrange
    localStorage.setItem("mms_platform_notif_ack_u:user-b", JSON.stringify(["n5"]));
    const harness = renderProbe("user-a");
    act(() => {
      hookResult?.ackAll(["n1"]);
    });

    // Act
    harness.rerender("user-b");
    act(() => {
      hookResult?.ackAll(["n6"]);
    });

    // Assert
    expect(hookResult?.ackedIds.has("n5")).toBe(true);
    expect(hookResult?.ackedIds.has("n1")).toBe(false);
    expect(JSON.parse(localStorage.getItem("mms_platform_notif_ack_u:user-b") ?? "[]")).toEqual([
      "n5",
      "n6",
    ]);
    expect(JSON.parse(localStorage.getItem("mms_platform_notif_ack_u:user-a") ?? "[]")).toEqual([
      "n1",
    ]);
    harness.cleanup();
  });
});
