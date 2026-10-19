import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSchema, todayISO, type Enrollment } from "@mms/shared";
import {
  EnrollmentOperationModal,
  type EnrollmentOperationModalProps,
} from "./EnrollmentOperationModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("@/components/app/DatePicker", () => ({
  DatePicker: ({ id, value }: { id: string; value: string }) => (
    <input id={id} readOnly value={value} />
  ),
}));
vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    title,
    saveLabel,
    saveDisabled,
    onSave,
    children,
  }: {
    open: boolean;
    title: string;
    saveLabel: string;
    saveDisabled?: boolean;
    onSave: () => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
        <button type="button" disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </button>
      </div>
    ) : null,
}));

const enrollment = { id: "e1", sessionId: "s1", classId: "c1" } as Enrollment;
const session = SessionSchema.parse({
  id: "s1",
  name: "Hifz 2026",
  classes: [
    { id: "c1", name: "Darja 1" },
    { id: "c2", name: "Darja 2" },
  ],
});

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

type Handlers = Pick<EnrollmentOperationModalProps, "onClose" | "onTransfer" | "onWithdraw">;

function render(kind: "transfer" | "withdraw", handlers: Handlers) {
  act(() =>
    root.render(
      <EnrollmentOperationModal
        kind={kind}
        enrollment={enrollment}
        session={session}
        isPending={false}
        onClose={handlers.onClose}
        onTransfer={handlers.onTransfer}
        onWithdraw={handlers.onWithdraw}
      />,
    ),
  );
}

function typeReason(text: string) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("reason field missing");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("EnrollmentOperationModal", () => {
  it("given a withdrawal with a reason, should submit today's date and close when saved", async () => {
    // Arrange
    const handlers = {
      onClose: vi.fn<Handlers["onClose"]>(),
      onTransfer: vi.fn<Handlers["onTransfer"]>(),
      onWithdraw: vi.fn<Handlers["onWithdraw"]>().mockResolvedValue(true),
    };
    render("withdraw", handlers);
    const save = container.querySelector("button");

    // Act
    const disabledBefore = save?.disabled;
    typeReason("Family moved away");
    await act(async () => save?.click());

    // Assert
    expect(disabledBefore).toBe(true);
    expect(handlers.onWithdraw).toHaveBeenCalledWith({
      effectiveOn: todayISO(),
      reason: "Family moved away",
    });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("given a transfer, should keep the session fixed and wait for a destination class", () => {
    // Arrange
    const handlers = {
      onClose: vi.fn<Handlers["onClose"]>(),
      onTransfer: vi.fn<Handlers["onTransfer"]>(),
      onWithdraw: vi.fn<Handlers["onWithdraw"]>(),
    };

    // Act
    render("transfer", handlers);
    typeReason("Moved to evening batch");

    // Assert
    const sessionSelect = container.querySelector("#enrollment-transfer-session");
    const save = container.querySelector("[role='dialog'] > button");
    expect(
      sessionSelect?.hasAttribute("disabled") ||
        sessionSelect?.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    expect(save).toBeInstanceOf(HTMLButtonElement);
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(handlers.onTransfer).not.toHaveBeenCalled();
  });
});
