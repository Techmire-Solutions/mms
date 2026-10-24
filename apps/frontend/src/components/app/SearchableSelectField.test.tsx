import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchableSelectField, type SearchableSelectFieldProps } from "./SearchableSelectField";

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchableSelectField controlled contract", () => {
  let container: HTMLDivElement;
  let root: Root;
  const defaults: SearchableSelectFieldProps = {
    label: "Person",
    search: "",
    onSearchChange: vi.fn(),
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
