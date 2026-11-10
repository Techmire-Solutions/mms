import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchableSelectField, type SearchableSelectFieldProps } from "./SearchableSelectField";

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchableSelectField", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSearchChange = vi.fn();
  const defaults: SearchableSelectFieldProps = {
    label: "Person",
    onSearchChange,
    searchLabel: "Find person",
    searchPlaceholder: "Search people",
    loadingLabel: "Loading people",
    value: "kept",
    onChange: vi.fn(),
    options: [{ value: "kept", label: "Selected person" }],
  };
  const render = (props: Partial<SearchableSelectFieldProps> = {}) =>
    act(() => {
      root.render(<SearchableSelectField {...defaults} {...props} />);
    });
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("keeps the selected option during fetching and associates labels and feedback", () => {
    render({ isLoading: true, required: true });
    const select = container.querySelector("select")!;
    expect(select.value).toBe("kept");
    expect(select.required).toBe(true);
    expect(container.querySelector("label")?.htmlFor).toBe(select.id);
    expect(document.getElementById(select.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Loading people",
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("filters the full option list inside the built-in search when no remote search is wired", () => {
    const onChange = vi.fn();
    render({
      onSearchChange: undefined,
      onChange,
      value: "",
      options: [
        { value: "a", label: "Ali" },
        { value: "b", label: "Bilal" },
        { value: "c", label: "Fatima" },
        { value: "d", label: "Hamza" },
        { value: "e", label: "Khadija" },
        { value: "f", label: "Zainab" },
      ],
    });
    act(() => {
      container
        .querySelector("select")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true }));
    });
    expect(
      Array.from(document.querySelectorAll('[role="option"]'), (option) => option.textContent),
    ).toEqual(["Fatima"]);
    act(() => {
      document
        .querySelector('input[role="combobox"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("renders no standalone search input above the dropdown", () => {
    render();
    expect(container.querySelector("input")).toBeNull();
  });

  it("types into the dropdown's built-in search and reports the query for remote filtering", () => {
    render({
      options: [
        { value: "a", label: "Ali" },
        { value: "b", label: "Bilal" },
        { value: "c", label: "Fatima" },
      ],
    });
    const select = container.querySelector("select")!;
    act(() => {
      select.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    const searchInput = document.querySelector<HTMLInputElement>('input[role="combobox"]');
    expect(searchInput).not.toBeNull();
    expect(searchInput?.value).toBe("a");
    expect(onSearchChange).toHaveBeenCalledWith("a");
    expect(searchInput?.getAttribute("aria-label")).toBe("Find person");
    expect(searchInput?.getAttribute("placeholder")).toBe("Search people");
  });

  it("keeps a short remote-backed list searchable through the popover", () => {
    render({ options: [{ value: "kept", label: "Selected person" }] });
    const select = container.querySelector("select")!;
    expect(select.getAttribute("aria-expanded")).toBe("false");
    act(() => {
      select.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(document.querySelector('input[role="combobox"]')).not.toBeNull();
  });

  it("announces errors and delegates retry and selection", () => {
    const onRetry = vi.fn();
    const onChange = vi.fn();
    render({ error: "Cannot load", onRetry, retryLabel: "Retry", onChange });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Cannot load");
    act(() => container.querySelector("button")?.click());
    expect(onRetry).toHaveBeenCalledOnce();
    act(() =>
      container.querySelector("select")?.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(onChange).toHaveBeenCalledWith("kept");
  });

  it("keeps disabled selections visible and prevents retries", () => {
    render({ disabled: true, error: "Cannot load", onRetry: vi.fn(), retryLabel: "Retry" });
    expect(container.querySelector("select")?.disabled).toBe(true);
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")?.disabled).toBe(true);
  });
});
