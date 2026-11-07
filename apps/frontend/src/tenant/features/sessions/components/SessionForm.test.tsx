import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionForm } from "./SessionForm";

vi.mock("@/hooks/useAcademicCatalog", () => ({
  useAcademicCatalogItems: () => ({ data: [] }),
  useExaminationSubjects: () => ({ data: [] }),
  useAcademicCatalogActions: () => ({
    save: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canRead: true,
    canWrite: true,
    canDelete: false,
    canEditSetup: false,
  }),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    language: "en",
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    activeCurrency: { code: "USD", symbol: "$" },
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useSessionConfig: () => ({
    settings: { defaultSessionType: "Hifz" },
    types: ["Hifz", "Alimiyyah"],
    statuses: ["active", "archived", "completed"],
  }),
}));

vi.mock("@/components/app/DatePicker", () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <input
      data-testid="datepicker"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    title,
    error,
    onSave,
    children,
  }: {
    title: React.ReactNode;
    error?: string;
    onSave?: () => void;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button data-testid="save-session-btn" type="button" onClick={onSave}>
        Save Session
      </button>
    </div>
  ),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SessionForm Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders form inputs with inputMode=decimal on baseFee", async () => {
    await act(async () => {
      root.render(<SessionForm open={true} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    const feeInput = container.querySelector("input[placeholder='0.00']") as HTMLInputElement;
    expect(feeInput).not.toBeNull();
    expect(feeInput.getAttribute("inputmode")).toBe("decimal");
  });

  it("does not show the archived-status hint for a new draft form", async () => {
    await act(async () => {
      root.render(<SessionForm open={true} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    expect(container.textContent).not.toContain("sessions.form.statusHint");
  });

  it("fails validation if required fields are missing", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(<SessionForm open={true} onClose={vi.fn()} onSave={onSave} />);
    });

    const saveBtn = container.querySelector(
      "[data-testid='save-session-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("sessions.form.nameRequired");
  });

  it("submits valid session payload to onSave", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(<SessionForm open={true} onClose={vi.fn()} onSave={onSave} />);
    });

    const nameInput = container.querySelector("input[class*='ps-10']") as HTMLInputElement;
    const datePickers = container.querySelectorAll("[data-testid='datepicker']");
    const feeInput = container.querySelector("input[placeholder='0.00']") as HTMLInputElement;
    const saveBtn = container.querySelector(
      "[data-testid='save-session-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(nameInput, "Academic Year 2026");
      setInputValue(datePickers[0] as HTMLInputElement, "2026-09-01");
      setInputValue(datePickers[1] as HTMLInputElement, "2027-06-30");
      setInputValue(feeInput, "350.50");
    });

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Academic Year 2026",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        baseFee: 350.5,
        // Category/program are catalog ids; the server fills defaults and the `type` snapshot.
        categoryId: "",
        programId: "",
      }),
    );
  });

  it("preserves updatedAt in the edit payload for optimistic concurrency", async () => {
    const onSave = vi.fn();
    const existing = {
      id: "sess-1",
      name: "Existing Session",
      type: "Hifz",
      status: "draft",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      baseFee: 100,
      currency: "USD",
      classes: [],
      faculty: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    await act(async () => {
      root.render(
        <SessionForm open={true} session={existing as never} onClose={vi.fn()} onSave={onSave} />,
      );
    });

    const nameInput = container.querySelector("input[class*='ps-10']") as HTMLInputElement;
    const saveBtn = container.querySelector(
      "[data-testid='save-session-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(nameInput, "Renamed Session");
    });
    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess-1",
        name: "Renamed Session",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
  });

  it("fails validation when endDate is before startDate", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(<SessionForm open={true} onClose={vi.fn()} onSave={onSave} />);
    });

    const nameInput = container.querySelector("input[class*='ps-10']") as HTMLInputElement;
    const datePickers = container.querySelectorAll("[data-testid='datepicker']");
    const saveBtn = container.querySelector(
      "[data-testid='save-session-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(nameInput, "Summer Session");
      setInputValue(datePickers[0] as HTMLInputElement, "2026-09-01");
      setInputValue(datePickers[1] as HTMLInputElement, "2026-06-01");
    });

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("sessions.form.endDateAfterStartDate");
  });

  it("preserves a dirty draft when the same session is refetched with a new object", async () => {
    const existing = {
      id: "sess-1",
      name: "Original Session",
      type: "Hifz",
      status: "draft",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      baseFee: 100,
      currency: "USD",
      classes: [],
      faculty: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await act(async () => {
      root.render(
        <SessionForm open={true} session={existing as never} onClose={vi.fn()} onSave={vi.fn()} />,
      );
    });
    const nameInput = container.querySelector("input[class*='ps-10']") as HTMLInputElement;
    await act(async () => setInputValue(nameInput, "User edit in progress"));

    // A detail refetch/live push creates a fresh object with the same id.
    await act(async () => {
      root.render(
        <SessionForm
          open={true}
          session={{ ...existing, name: "Server refetch" } as never}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );
    });
    expect((container.querySelector("input[class*='ps-10']") as HTMLInputElement).value).toBe(
      "User edit in progress",
    );

    // Switching to a different session id is an explicit new form and does reset.
    await act(async () => {
      root.render(
        <SessionForm
          open={true}
          session={{ ...existing, id: "sess-2", name: "Second session" } as never}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );
    });
    expect((container.querySelector("input[class*='ps-10']") as HTMLInputElement).value).toBe(
      "Second session",
    );
  });
});
