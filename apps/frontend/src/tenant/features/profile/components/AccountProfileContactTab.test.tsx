import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TenantUserProfile } from "@mms/contracts";
import { AccountProfileContactTab } from "./AccountProfileContactTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function buildProfile(overrides: Partial<TenantUserProfile> = {}): TenantUserProfile {
  return {
    id: "user-1",
    loginEmail: "admin@example.com",
    name: "Resp Admin",
    role: "admin",
    workspaceSubdomain: "demo",
    contact: null,
    ...overrides,
  };
}

function renderCard(profile: TenantUserProfile): HTMLElement {
  const html = renderToStaticMarkup(
    <AccountProfileContactTab
      profile={profile}
      name=""
      phone=""
      contactEmail=""
      savingContact={false}
      onNameChange={vi.fn()}
      onPhoneChange={vi.fn()}
      onContactEmailChange={vi.fn()}
      onSaveContact={vi.fn(async () => undefined)}
    />,
  );
  const card = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
  if (!(card instanceof HTMLElement)) throw new Error("expected a card element");
  return card;
}

describe("AccountProfileContactTab", () => {
  it("given the accent stripe, should inset the start edge once (title bar and body) rather than stacking the card inset", () => {
    // Arrange
    const card = renderCard(buildProfile());

    // Act
    const titleBar = card.children[1];
    const body = card.children[2];

    // Assert
    expect(card.classList.contains("ps-0")).toBe(true);
    expect(card.classList.contains("sm:ps-6")).toBe(false);
    expect(titleBar?.classList.contains("sm:ps-6")).toBe(true);
    expect(body?.classList.contains("sm:ps-6")).toBe(true);
  });

  it("given no linked contact, should explain that an administrator must link one", () => {
    // Arrange
    const card = renderCard(buildProfile());

    // Act
    const text = card.textContent ?? "";

    // Assert
    expect(text).toContain("account.unlinkedTitle");
    expect(text).toContain("account.noContact");
    expect(card.querySelector("form")).toBeNull();
  });
});
