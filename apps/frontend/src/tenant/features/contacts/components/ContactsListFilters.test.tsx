import React, { useEffect, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsListFilters } from "./ContactsListFilters";
import { useDebounce } from "@/hooks/useDebounce";

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

// Test double mirroring the real toolbar's leaf-debounce contract (mms-hooks §5):
// keystrokes stay local, the settled value is pushed once after 250 ms, and
// external resets are adopted without being echoed back.
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
  }) => {
    const [draft, setDraft] = useState(search);
    const debounced = useDebounce(draft, 250);
    const lastPushedRef = React.useRef(search);
    useEffect(() => {
      if (debounced === lastPushedRef.current) return;
      lastPushedRef.current = debounced;
      onSearchChange(debounced);
    }, [debounced, onSearchChange]);
    useEffect(() => {
      if (search === lastPushedRef.current) return;
      lastPushedRef.current = search;
      setDraft(search);
    }, [search]);
    return (
      <div data-testid="work-toolbar">
        <input
          aria-label="contact search"
          placeholder={searchPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div>{filterButton}</div>
      </div>
    );
  },
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
