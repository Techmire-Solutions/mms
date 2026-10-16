import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserAvatar, USER_STATUS_COLORS, getInitials } from "./UserAvatar";

describe("UserAvatar Component (@shared/ui)", () => {
  it("computes initials correctly with getInitials helper", () => {
    expect(getInitials("Syeda Fatima")).toBe("SF");
    expect(getInitials("Zaid")).toBe("Z");
    expect(getInitials(null)).toBe("?");
    expect(getInitials("")).toBe("?");
  });

  it("renders 2-letter initials for a given name", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-1" name="Syeda Fatima" />);
    expect(html).toContain("SF");
    expect(html).toContain("bg-primary/15 text-primary");
  });

  it("renders User icon fallback when name is empty", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-2" name="" />);
    expect(html).toContain("lucide-user");
  });

  it("uses custom fallbackColorResolver when supplied", () => {
    const html = renderToStaticMarkup(
      <UserAvatar
        id="usr-3"
        name="Ali"
        gender="male"
        fallbackColorResolver={(gender) => (gender === "male" ? "text-info" : "text-muted")}
      />,
    );
    expect(html).toContain("text-info");
  });

  it("renders status presence dot and sr-only label", () => {
    const html = renderToStaticMarkup(
      <UserAvatar id="usr-4" name="Omar" status="online" statusAriaLabel="Active now" />,
    );
    expect(html).toContain(USER_STATUS_COLORS.online);
    expect(html).toContain("Active now");
  });

  it("renders badgeNode when provided", () => {
    const html = renderToStaticMarkup(
      <UserAvatar id="usr-5" name="Zainab" badgeNode={<span data-testid="star">★</span>} />,
    );
    expect(html).toContain('data-testid="star"');
    expect(html).toContain("★");
  });

  it("renders skeleton loader when isLoading is true", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-6" isLoading size="lg" />);
    expect(html).toContain("animate-pulse");
    expect(html).toContain("h-11 w-11");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders tooltip title when showTooltip is true", () => {
    const html = renderToStaticMarkup(<UserAvatar id="usr-7" name="Hassan" showTooltip />);
    expect(html).toContain('title="Hassan"');
  });
});
