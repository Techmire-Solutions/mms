import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormSelect } from "./FormSelect";
import { filterSelectOptions } from "./useFormSelectSearch";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ACCOUNTS = [
  { value: "1000", label: "1000 · Cash in Hand" },
  { value: "1010", label: "1010 · Bank — Meezan" },
  { value: "2000", label: "2000 · Accounts Payable" },
  { value: "3000", label: "3000 · Equity" },
  { value: "4000", label: "4000 · Tuition Fee Income" },
  { value: "5000", label: "5000 · Salaries Expense" },
];

describe("filterSelectOptions", () => {
  it("given a query, should keep options matching every term case- and accent-insensitively", () => {
    const options = [
      { value: "", label: "Select" },
      ...ACCOUNTS,
      { value: "x", label: "Café Supplies" },
    ];
    expect(filterSelectOptions(options, "")).toHaveLength(options.length);
    expect(filterSelectOptions(options, "cash").map((o) => o.value)).toEqual(["1000"]);
    expect(filterSelectOptions(options, "fee 4000").map((o) => o.value)).toEqual(["4000"]);
    expect(filterSelectOptions(options, "CAFE").map((o) => o.value)).toEqual(["x"]);
    expect(filterSelectOptions(options, "select")).toEqual([]);
  });
});

describe("FormSelect", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const render = (props: Partial<React.ComponentProps<typeof FormSelect>> = {}) => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <FormSelect
          id="acct"
          value=""
          onChange={onChange}
          options={ACCOUNTS}
          placeholder="Select account"
          {...props}
        />,
      );
    });
    return onChange;
  };

  it("given a long list, should keep the native select as the form control", () => {
    render();
    const select = container.querySelector<HTMLSelectElement>("select#acct");
    expect(select?.options).toHaveLength(ACCOUNTS.length + 1);
    expect(select?.getAttribute("aria-expanded")).toBe("false");
  });

  it("given a long list, should filter by typed text and pick when Enter is pressed", () => {
    const onChange = render();
    const select = container.querySelector<HTMLSelectElement>("select#acct")!;
    act(() => {
      select.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
    });
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    expect(input.value).toBe("s");

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(input, "salar");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const options = document.querySelectorAll('[role="option"]');
    expect(Array.from(options, (o) => o.textContent)).toEqual(["5000 · Salaries Expense"]);

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("5000");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("given no match, should announce the empty state when searching", () => {
    render();
    act(() => {
      container
        .querySelector("select")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "#", bubbles: true }));
    });
    expect(document.querySelector('[role="status"]')?.textContent).toBe("common.noMatchingOptions");
  });

  it("given a short or disabled list, should stay a plain native select", () => {
    render({ options: ACCOUNTS.slice(0, 3) });
    expect(container.querySelector("select")?.hasAttribute("aria-expanded")).toBe(false);
    render({ disabled: true });
    expect(container.querySelector("[data-form-select-hit-area]")).toBeNull();
  });

  it("given placeholder and an explicit empty option, should render without React duplicate key warnings", () => {
    const consoleError = vi.spyOn(console, "error");
    render({
      placeholder: "Choose an option",
      options: [{ value: "", label: "None" }, ...ACCOUNTS.slice(0, 2)],
    });
    const keyWarnings = consoleError.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("Encountered two children with the same key"),
    );
    expect(keyWarnings).toHaveLength(0);
    consoleError.mockRestore();
  });
});
