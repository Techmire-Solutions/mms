import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("feedback state accessibility", () => {
  it("announces empty results politely and preserves the supplied action", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No results" description="Adjust filters" action={<a href="/">Reset</a>} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Adjust filters");
    expect(html).toContain('href="/"');
  });

  it("keeps decorative dashed states silent and icon-free", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Nothing here" variant="dashed" role="presentation" />,
    );
    expect(html).not.toContain("aria-live");
    expect(html).not.toContain("<svg");
  });

  it("announces errors assertively with an optional retry action", () => {
    const html = renderToStaticMarkup(
      <ErrorState type="network" description="Connection interrupted" onRetry={() => {}} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("errors.state.network");
    expect(html).toContain("common.tryAgain");
    expect(renderToStaticMarkup(<ErrorState />)).not.toContain("<button");
  });
});
