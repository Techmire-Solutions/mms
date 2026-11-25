import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MoneyAmount } from "./MoneyAmount.js";
import { AccountTypeBadge } from "./AccountTypeBadge.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function render(node: React.ReactNode): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("accounting shared widgets", () => {
  it("renders money with the requested currency", () => {
    render(<MoneyAmount amount="1234.50" currency="USD" decimalPlaces={2} />);
    expect(host.textContent).toContain("$");
    expect(host.textContent).toContain("1,234.50");
  });

  it("renders an account type badge", () => {
    render(<AccountTypeBadge type="Asset" />);
    expect(host.textContent).toBe("Asset");
  });
});
