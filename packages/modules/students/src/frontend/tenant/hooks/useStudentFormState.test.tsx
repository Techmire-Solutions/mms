import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudentFormState } from "./useStudentFormState";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    dir: "ltr",
  }),
}));

vi.mock("@mms/fe-core/lib/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ language: "en" }),
}));

vi.mock("../host/contactsCollection", () => ({
  useContactMutations: () => ({
    updateContact: { mutateAsync: vi.fn() },
  }),
}));

const mockConfig = {
  settings: {
    autoGenerateId: true,
    grNumberTemplate: "GR-{number}",
    fields: {},
  },
  statuses: ["active", "inactive"],
  isFieldEnabled: vi.fn(() => true),
  isFieldRequired: vi.fn(() => false),
};

vi.mock("../host/useStudentConfig", () => ({
  useStudentConfig: () => mockConfig,
}));

const mockLinkedContact = { id: "cnt-1", name: "Zayd", dob: "2015-05-10" };

vi.mock("./useStudentFormLinkedData", () => ({
  useStudentFormLinkedData: () => ({
    linkedContact: mockLinkedContact,
    linkedGenderRaw: "male",
    linkedGenderLabel: "Male",
    linkedDob: "2015-05-10",
    nextGrNumber: "GR-002",
    autoGenerateId: true,
    handleGrNumberChange: vi.fn(),
    excludeIds: [],
    isGrAutoAssigned: true,
  }),
}));

describe("useStudentFormState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ReturnType<typeof useStudentFormState>;

  function render(student = null): void {
    function TestComponent() {
      state = useStudentFormState({
        student,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("initializes draft and computes rawDob and effective linkedDob", () => {
    render();

    expect(state.formInstanceId).toBe("new");
    expect(state.rawDob).toBe("2015-05-10");
    expect(state.linkedDob).toBe("10/05/2015");
    expect(state.isCreate).toBe(true);
    expect(state.isDirty).toBe(false);
  });

  it("updates draft and tracks isDirty when changes occur", () => {
    render();

    act(() => {
      state.updateDraft({ notes: "Special scholarship student" });
    });

    expect(state.studentDraft.notes).toBe("Special scholarship student");
    expect(state.isDirty).toBe(true);
  });

  it("handles contactDobOverride and recalculates rawDob", () => {
    render();

    act(() => {
      void state.handleStudentDobChange("2016-08-15");
    });

    expect(state.rawDob).toBe("2016-08-15");
    expect(state.linkedDob).toBe("15/08/2016");
  });
});
