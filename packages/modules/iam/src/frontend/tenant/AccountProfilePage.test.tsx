import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AccountProfile from "./AccountProfilePage";

const mockController = vi.fn();

vi.mock("./hooks/useAccountProfilePageController", () => ({
  useAccountProfilePageController: () => mockController(),
}));

describe("AccountProfilePage", () => {
  it("renders structural skeleton without spinning loaders when isLoading is true", () => {
    mockController.mockReturnValue({
      t: (k: string) => k,
      isLoading: true,
      isError: false,
      profile: null,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<AccountProfile />);

    // Skeleton pulse container should be present
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");

    // No spinner circle should be rendered
    expect(html).not.toContain("animate-spin");
  });
});
