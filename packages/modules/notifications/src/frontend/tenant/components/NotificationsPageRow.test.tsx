import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TenantNotification } from "../lib/notificationsTypes";
import { NotificationsPageRow } from "./NotificationsPageRow";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function buildNotification(overrides: Partial<TenantNotification> = {}): TenantNotification {
  return {
    id: "low-attendance",
    type: "attendance",
    title: "Low attendance today",
    desc: "Present rate is 0% — below the 75% target.",
    time: "Today",
    urgent: true,
    read: false,
    target: { kind: "attendanceDay", date: "2026-11-22" },
    ...overrides,
  };
}

function renderRow(notification: TenantNotification): HTMLButtonElement {
  const html = renderToStaticMarkup(
    <NotificationsPageRow notification={notification} onOpen={vi.fn()} />,
  );
  const row = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
  if (!(row instanceof HTMLButtonElement)) throw new Error("expected a button row");
  return row;
}

describe("NotificationsPageRow", () => {
  it("given a wide row, should stretch the button content so the chevron sits on the end edge", () => {
    // Arrange
    const row = renderRow(buildNotification());

    // Act
    const content = row.querySelector('[data-slot="button-content"]');
    const chevron = content?.lastElementChild;

    // Assert
    expect(row.classList.contains("[&>span]:w-full")).toBe(true);
    expect(row.classList.contains("[&_[data-slot=button-content]]:w-full")).toBe(true);
    expect(row.classList.contains("[&_[data-slot=button-content]]:justify-start")).toBe(true);
    expect(chevron?.tagName.toLowerCase()).toBe("svg");
  });

  it("given an unread urgent notification, should show the urgent badge and unread tint", () => {
    // Arrange
    const row = renderRow(buildNotification());

    // Act
    const text = row.textContent ?? "";

    // Assert
    expect(text).toContain("notifications.urgentLabel");
    expect(row.classList.contains("bg-primary/5")).toBe(true);
  });

  it("given a read notification without a target, should disable the row and drop the chevron", () => {
    // Arrange
    const row = renderRow(buildNotification({ read: true, urgent: false, target: undefined }));

    // Act
    const chevron = row.querySelector("svg.rtl\\:rotate-180");

    // Assert
    expect(row.disabled).toBe(true);
    expect(chevron).toBeNull();
    expect(row.classList.contains("bg-primary/5")).toBe(false);
  });
});
