import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsListFilters } from "./ContactsListFilters";

vi.mock("@/tenant/features/contacts/hooks/useContactsToolbarModel", () => ({
  useContactsToolbarModel: () => ({
    t: (key: string) => key,
    genders: [],
    sortOptions: [],
    columnRegistry: [],
    updateUserColumnLayout: vi.fn(),
    handleResetColumnLayout: vi.fn(),
    columnCustomizerLabels: {} as never,
  }),
}));

vi.mock("@/components/app/ModuleWorkToolbar", () => ({
  ModuleWorkToolbar: ({
    search,
    onSearchChange,
    searchPlaceholder,
    filterButton,
  }: {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    filterButton: React.ReactNode;
  }) => (
    <div data-testid="work-toolbar">
      <input
        aria-label="contact search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div>{filterButton}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/contacts/components/ContactsFiltersMenuButton", () => ({
  ContactsFiltersMenuButton: () => <button data-testid="filters-menu">Filters</button>,
}));

type FiltersProps = React.ComponentProps<typeof ContactsListFilters>;

function filtersProps(overrides: Partial<FiltersProps> = {}): FiltersProps {
  return {
    search: "",
    onSearchChange: vi.fn(),
    filterGender: "all",
    onGenderChange: vi.fn(),
    quickFilter: "all",
    onQuickFilterChange: vi.fn(),
    sortField: "name",
    sortDir: "asc",
    onSort: vi.fn(),
    onSortDirChange: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
    viewMode: "table",
    onViewModeChange: vi.fn(),
    ...overrides,
  };
}

/** React 19 tracks the DOM value, so the native setter must be used. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ContactsListFilters Component", () => {
  it("renders work toolbar with search input and filters menu button", () => {
    const html = renderToStaticMarkup(<ContactsListFilters {...filtersProps()} />);

    expect(html).toContain("contacts.searchPlaceholder");
    expect(html).toContain("filters-menu");
  });
});

describe("ContactsListFilters search debounce", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function searchInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="contact search"]');
    if (!input) throw new Error("search input not rendered");
    return input;
  }

  it("pushes only the settled value to the page controller", () => {
    const onSearchChange = vi.fn();
    act(() => {
      root.render(<ContactsListFilters {...filtersProps({ onSearchChange })} />);
    });

    act(() => {
      typeInto(searchInput(), "a");
      typeInto(searchInput(), "al");
      typeInto(searchInput(), "ali");
    });
    // Keystrokes stay local — the page controller has not been notified yet.
    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("ali");
  });

  it("adopts an external reset (clear filters / drill-down) without echoing it back", () => {
    const onSearchChange = vi.fn();
    act(() => {
      root.render(<ContactsListFilters {...filtersProps({ search: "ali", onSearchChange })} />);
    });
    expect(searchInput().value).toBe("ali");

    act(() => {
      root.render(<ContactsListFilters {...filtersProps({ search: "", onSearchChange })} />);
    });

    expect(searchInput().value).toBe("");
    expect(onSearchChange).not.toHaveBeenCalled();
  });
});
