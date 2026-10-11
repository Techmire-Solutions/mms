import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactIdentityMeta } from "./ContactIdentityMeta";

vi.mock("@/components/ui/PersonIdentityMeta", () => ({
  PersonIdentityMeta: ({
    gender,
    isSyed,
    children,
  }: {
    gender?: string;
    isSyed?: boolean;
    children?: React.ReactNode;
  }) => (
    <div data-testid="person-identity-meta">
      <span>Gender: {gender}</span>
      {isSyed && <span>Syed</span>}
      <div>{children}</div>
    </div>
  ),
}));

describe("ContactIdentityMeta Component", () => {
  it("renders person identity meta with gender and syed badge", () => {
    const html = renderToStaticMarkup(
      <ContactIdentityMeta gender="male" isSyed={true}>
        <span>Custom child</span>
      </ContactIdentityMeta>,
    );

    expect(html).toContain("Gender: male");
    expect(html).toContain("Syed");
    expect(html).toContain("Custom child");
  });
});
