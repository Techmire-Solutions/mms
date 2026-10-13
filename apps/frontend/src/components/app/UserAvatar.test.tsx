import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserAvatar } from "./UserAvatar";

describe("UserAvatar Component", () => {
  it("renders 2-letter initials for a given name", () => {
    const html = renderToStaticMarkup(
      <UserAvatar id="usr-1" name="Syeda Fatima" gender="female" />,
    );

    expect(html).toContain("SF");
    expect(html).toContain("text-secondary");
  });

  it("renders User icon fallback when name is not provided or empty", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-2" name="" gender="male" />);

    expect(html).toContain("lucide-user");
    expect(html).toContain("text-info");
  });

  it("renders presence indicator and sr-only label when status is provided", () => {
    const html = renderToStaticMarkup(
      <UserAvatar id="usr-3" name="Ali Raza" status="online" statusAriaLabel="Active now" />,
    );

    expect(html).toContain("bg-success");
    expect(html).toContain("Active now");
  });

  it("renders custom badgeNode when provided", () => {
    const html = renderToStaticMarkup(
      <UserAvatar id="usr-4" name="Zainab" badgeNode={<span id="test-badge">★</span>} />,
    );

    expect(html).toContain("test-badge");
    expect(html).toContain("★");
  });

  it("renders skeleton loader when isLoading is true", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-5" isLoading={true} size="lg" />);

    expect(html).toContain("animate-pulse");
    expect(html).toContain("h-11 w-11");
    expect(html).toContain('aria-hidden="true"');
  });

  it("adds tooltip title when showTooltip is true", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-6" name="Hassan" showTooltip={true} />);

    expect(html).toContain('title="Hassan"');
  });
});
