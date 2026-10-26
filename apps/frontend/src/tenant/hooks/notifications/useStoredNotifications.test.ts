import { describe, it, expect } from "vitest";
import { toStoredNotificationItem } from "./useStoredNotifications";

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

describe("toStoredNotificationItem", () => {
  it("given a stored waitlist seat offer, should render it as an Admissions notification", () => {
    // Arrange
    const record = {
      id: "n1",
      kind: "waitlist_seat_offered" as const,
      entityType: "registration_application",
      entityId: "app-1",
      subjectLabel: "Amina Khan (APP-7K2QX9MD)",
      contextLabel: "Hifz A",
      createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      read: false,
    };

    // Act
    const item = toStoredNotificationItem(record, t, "en");

    // Assert
    expect(item).toMatchObject({
      id: "stored:n1",
      storedId: "n1",
      type: "admission",
      title: "notifications.waitlistSeatOfferedTitle",
      target: { kind: "admissions" },
      read: false,
    });
    expect(item.desc).toContain("Amina Khan (APP-7K2QX9MD)");
    expect(item.desc).toContain("Hifz A");
    expect(item.time).toMatch(/2 minutes ago/);
  });
});
