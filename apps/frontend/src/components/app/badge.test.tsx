import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge Component", () => {
  it("renders default badge with children", () => {
    const html = renderToStaticMarkup(<Badge>Active</Badge>);
    expect(html).toContain("Active");
    expect(html).toContain("bg-primary");
    expect(html).toContain("rounded-md");
  });

  it("renders primary variant with children", () => {
    const html = renderToStaticMarkup(<Badge variant="primary">Primary Badge</Badge>);
    expect(html).toContain("Primary Badge");
    expect(html).toContain("bg-primary");
    expect(html).toContain("rounded-md");
  });

  it("renders pill shape when pill=true", () => {
    const html = renderToStaticMarkup(<Badge pill>Pill Badge</Badge>);
    expect(html).toContain("Pill Badge");
    expect(html).toContain("rounded-full");
  });

  it("renders semantic tone styles", () => {
    const html = renderToStaticMarkup(<Badge tone="success">Success</Badge>);
    expect(html).toContain("Success");
    expect(html).toContain("bg-success/10");
  });

  it("renders as button element with default type=button", () => {
    const html = renderToStaticMarkup(
      <Badge as="button" onClick={vi.fn()}>
        Clickable
      </Badge>,
    );
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain("Clickable");
  });

  it("omits type attribute on non-button elements", () => {
    const html = renderToStaticMarkup(<Badge as="span">Span Badge</Badge>);
    expect(html).toContain("<span");
    expect(html).not.toContain('type="');
  });

  it("renders status indicator dot with pulse animation", () => {
    const html = renderToStaticMarkup(
      <Badge dot pulse>
        Live
      </Badge>,
    );
    expect(html).toContain("animate-pulse");
    expect(html).toContain("rounded-full bg-current");
  });

  it("renders remove button with accessible label", () => {
    const onRemove = vi.fn();
    const html = renderToStaticMarkup(
      <Badge onRemove={onRemove} removeAriaLabel="Remove Tag">
        Removable
      </Badge>,
    );
    expect(html).toContain('aria-label="Remove Tag"');
    expect(html).toContain("lucide-x");
  });
});
