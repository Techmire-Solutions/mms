import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO, type SessionClassSection } from "@mms/shared";
import { SectionOperationModal, type SectionOperationModalProps } from "./SectionOperationModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/app/DatePicker", () => ({
  DatePicker: ({ id, value }: { id: string; value: string }) => (
    <input id={id} readOnly value={value} />
  ),
}));
vi.mock("@/components/app/FormCheckboxCard", () => ({
  FormCheckboxCard: ({
    id,
    label,
    checked,
    onCheckedChange,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <label htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {label}
    </label>
  ),
}));
vi.mock("@/tenant/hooks/collections/enrollments", () => ({
  useEnrollmentsCollection: () => [
    { id: "e1", studentId: "s1", studentName: "Ali", sectionId: "sec-a", status: "confirmed" },
    { id: "e2", studentId: "s2", studentName: "Bilal", sectionId: "sec-a", status: "withdrawn" },
  ],
}));
vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    saveLabel,
    saveDisabled,
    onSave,
    children,
  }: {
    open: boolean;
    saveLabel: string;
    saveDisabled?: boolean;
    onSave: () => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" data-save disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </button>
      </div>
    ) : null,
}));

const section: SessionClassSection = {
  id: "sec-a",
  name: "A",
  capacity: 10,
  room: "",
  status: "active",
  enrolled: 1,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Handlers = Pick<
  SectionOperationModalProps,
  "onDismiss" | "onMerge" | "onSplit" | "onCloseSection"
>;
const makeHandlers = () => ({
  onDismiss: vi.fn<Handlers["onDismiss"]>(),
  onMerge: vi.fn<Handlers["onMerge"]>().mockResolvedValue(true),
  onSplit: vi.fn<Handlers["onSplit"]>().mockResolvedValue(true),
  onCloseSection: vi.fn<Handlers["onCloseSection"]>().mockResolvedValue(true),
});

function render(kind: SectionOperationModalProps["kind"], handlers: Handlers) {
  act(() =>
    root.render(
      <SectionOperationModal
        kind={kind}
        classId="cls-1"
        section={section}
        siblings={[]}
        isPending={false}
        {...handlers}
      />,
    ),
  );
}

function setValue(element: Element | null, value: string) {
  if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement))
    throw new Error("field missing");
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const saveButton = () => container.querySelector("[data-save]") as HTMLButtonElement;

describe("SectionOperationModal", () => {
  it("given a section that still has students, should keep close disabled and say so", () => {
    // Arrange
    const handlers = makeHandlers();

    // Act
    render("close", handlers);
    setValue(container.querySelector("textarea"), "Not needed any more");

    // Assert
    expect(container.textContent).toContain("sessions.sections.ops.closeOccupied");
    expect(saveButton().disabled).toBe(true);
  });

  it("given a merge without a target, should keep save disabled", () => {
    // Arrange
    const handlers = makeHandlers();

    // Act
    render("merge", handlers);
    setValue(container.querySelector("textarea"), "Combine the groups");

    // Assert
    expect(saveButton().disabled).toBe(true);
    expect(handlers.onMerge).not.toHaveBeenCalled();
  });

  it("given a split, should list only live students and submit the chosen ones", async () => {
    // Arrange
    const handlers = makeHandlers();
    render("split", handlers);

    // Act
    setValue(container.querySelector("#cls-1-split-name"), "C");
    act(() => (container.querySelector("#split-e1") as HTMLInputElement).click());
    setValue(container.querySelector("textarea"), "Too many in A");
    await act(async () => saveButton().click());

    // Assert
    expect(container.querySelector("#split-e2")).toBeNull();
    expect(handlers.onSplit).toHaveBeenCalledWith({
      name: "C",
      capacity: 30,
      enrollmentIds: ["e1"],
      effectiveOn: todayISO(),
      reason: "Too many in A",
    });
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });
});
