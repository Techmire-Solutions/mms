import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, ContactPickerOption, ContactPickerSearchQuery } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const pickerMocks = vi.hoisted(() => ({
  search: vi.fn(),
  option: vi.fn(),
}));

vi.mock("@/tenant/hooks/collections/contacts", () => ({
  useContactPickerSearch: (query: ContactPickerSearchQuery, enabled: boolean) =>
    pickerMocks.search(query, enabled),
  useContactPickerOption: (id: string | undefined, enabled: boolean) =>
    pickerMocks.option(id, enabled),
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/clientErrorReporting", () => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/imageUpload", () => ({ uploadUserImage: vi.fn() }));

import { useContactPickerState } from "./useContactPickerState";

const OPTION: ContactPickerOption = {
  id: "c1",
  name: "Ali Khan",
  phone: "+923001234567",
  email: "ali@example.com",
  city: "Lahore",
};

type PickerState = ReturnType<typeof useContactPickerState>;

describe("useContactPickerState (server mode)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: PickerState;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pickerMocks.search.mockReset().mockReturnValue({
      data: { body: { contacts: [OPTION] } },
      isFetching: false,
    });
    pickerMocks.option.mockReset().mockReturnValue({ data: { body: { contact: OPTION } } });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderState(overrides: Partial<Parameters<typeof useContactPickerState>[0]> = {}): void {
    function TestComponent() {
      latest = useContactPickerState({
        value: null,
        onChange: () => {},
        ...overrides,
      });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  it("queries the lean picker endpoint and maps options to Contacts", () => {
    renderState();

    expect(pickerMocks.search).toHaveBeenLastCalledWith({ search: "", limit: 8 }, false);

    act(() => {
      latest.setOpen(true);
    });

    expect(pickerMocks.search).toHaveBeenLastCalledWith({ search: "", limit: 8 }, true);
    expect(latest.matches).toEqual([
      {
        id: "c1",
        name: "Ali Khan",
        firstName: "Ali",
        phone: "+923001234567",
        email: "ali@example.com",
        addresses: [{ city: "Lahore" }],
      } satisfies Contact,
    ]);
  });

  it("passes picker filters and capped excludeIds through the query", () => {
    renderState({
      filterGender: "male",
      hasPhone: true,
      excludeIds: ["c9", null, "c8"],
    });

    expect(pickerMocks.search).toHaveBeenLastCalledWith(
      { search: "", limit: 8, gender: "male", hasPhone: true, excludeIds: "c9,c8" },
      false,
    );
  });

  it("resolves the selected contact from the picker option endpoint", () => {
    renderState({ value: "c1" });

    expect(pickerMocks.option).toHaveBeenLastCalledWith("c1", true);
    expect(latest.selected?.name).toBe("Ali Khan");
    expect(latest.selected?.addresses).toEqual([{ city: "Lahore" }]);
  });
});

describe("useContactPickerState (local mode)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: PickerState;

  const LOCAL_CONTACT: Contact = {
    id: "l1",
    name: "Local Person",
    firstName: "Local",
    phone: "+923009999999",
    addresses: [{ city: "Karachi" }],
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pickerMocks.search.mockReset().mockReturnValue({ data: undefined, isFetching: false });
    pickerMocks.option.mockReset().mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderState(): void {
    function TestComponent() {
      latest = useContactPickerState({
        value: "l1",
        onChange: () => {},
        contacts: [LOCAL_CONTACT],
      });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  it("keeps using the provided contacts list and never enables server fetch", () => {
    renderState();

    const [query, enabled] = pickerMocks.search.mock.calls.at(-1) ?? [];
    expect(query).toEqual({ search: "", limit: 8 });
    expect(enabled).toBe(false);
    expect(pickerMocks.option.mock.calls.at(-1)?.[1]).toBe(false);
    expect(latest.matches).toEqual([LOCAL_CONTACT]);
    expect(latest.selected).toEqual(LOCAL_CONTACT);
  });
});
