import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { PlatformBreadcrumbProvider } from "@/platform/lib/PlatformBreadcrumbContext";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

describe("PlatformBreadcrumbProvider", () => {
  it("given nested segments, should render a three-level trail", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformBreadcrumbProvider>
          <Breadcrumb
            ariaLabel="Breadcrumb"
            items={[
              { label: "Console", href: "/platform/dashboard" },
              { label: "Users", href: "/platform/users" },
              { label: "Admin Name" },
            ]}
          />
        </PlatformBreadcrumbProvider>
      </MemoryRouter>,
    );

    expect(html).toContain("Console");
    expect(html).toContain("Users");
    expect(html).toContain("Admin Name");
  });
});
