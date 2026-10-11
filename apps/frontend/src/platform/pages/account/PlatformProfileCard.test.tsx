import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformProfileCard } from "./PlatformProfileCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlatformProfileCard Component", () => {
  it("renders profile card with email, creation date, and verification status", () => {
    const html = renderToStaticMarkup(
      <PlatformProfileCard
        profile={{
          email: "operator@platform.internal",
          createdAt: "2025-01-01T00:00:00Z",
          emailVerifiedAt: "2025-01-02T00:00:00Z",
        }}
      />,
    );

    expect(html).toContain("operator@platform.internal");
    expect(html).toContain("platform.profileEmail");
    expect(html).toContain("platform.profileMemberSince");
    expect(html).toContain("platform.profileEmailVerified");
  });

  it("omits verification banner when email is not verified", () => {
    const html = renderToStaticMarkup(
      <PlatformProfileCard
        profile={{
          email: "unverified@platform.internal",
          createdAt: "2025-01-01T00:00:00Z",
          emailVerifiedAt: null,
        }}
      />,
    );

    expect(html).toContain("unverified@platform.internal");
    expect(html).not.toContain("platform.profileEmailVerified");
  });
});
