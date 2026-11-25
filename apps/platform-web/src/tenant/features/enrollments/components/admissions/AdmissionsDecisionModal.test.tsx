import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationApplication } from "@mms/contracts";
import { AdmissionsDecisionModal } from "./AdmissionsDecisionModal";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    children,
    error,
    onSave,
  }: {
    children: React.ReactNode;
    error?: string | readonly string[];
    onSave?: () => Promise<void> | void;
  }) => (
    <div>
      {error ? <div role="alert">{Array.isArray(error) ? error.join(" ") : error}</div> : null}
      {children}
      <button type="button" data-testid="decision-save" onClick={() => void onSave?.()}>
        save
      </button>
    </div>
  ),
}));

const application: RegistrationApplication = {
  id: "app-1",
  reference: "REG-1",
  linkId: "link-1",
  sessionId: "s-1",
  sessionName: "Session",
  classId: "c-1",
  className: "Class",
  preferredSectionId: null,
  fullName: "Aisha",
  guardianName: "Fatima",
  dateOfBirth: "2010-01-01",
  gender: "female",
  phone: "+923001234567",
  email: null,
  address: null,
  previousMadrasa: null,
  status: "submitted",
  waitlistPosition: null,
  eligibilityReasons: [],
  matchedStudentId: null,
  studentId: null,
  enrollmentId: null,
  reviewReason: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function renderModal(
  decision: "approve" | "reject" | "waitlist" | "under_review",
  onConfirm = vi.fn().mockResolvedValue(true),
): Promise<{ container: HTMLDivElement; onConfirm: ReturnType<typeof vi.fn> }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AdmissionsDecisionModal
        open={true}
        decision={decision}
        applications={[application]}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
  });
  return { container, onConfirm };
}

async function setReason(container: HTMLDivElement, value: string): Promise<void> {
  const reason = container.querySelector<HTMLTextAreaElement>("#admissions-reason");
  if (!reason) throw new Error("reason field missing");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(reason, value);
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AdmissionsDecisionModal reason contract", () => {
  it("requires a non-empty reason for reject", async () => {
    const { container, onConfirm } = await renderModal("reject");
    const save = container.querySelector<HTMLButtonElement>('[data-testid="decision-save"]');

    await act(async () => save?.click());

    expect(container.textContent).toContain("enrollments.admissions.rejectReasonRequired");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("accepts a one-character reject reason (shared schema allows it)", async () => {
    const { container, onConfirm } = await renderModal("reject");
    await setReason(container, "x");
    const save = container.querySelector<HTMLButtonElement>('[data-testid="decision-save"]');

    await act(async () => save?.click());

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "reject", reason: "x" }),
    );
  });

  it("allows a waitlist decision without a reason", async () => {
    const { container, onConfirm } = await renderModal("waitlist");
    const save = container.querySelector<HTMLButtonElement>('[data-testid="decision-save"]');

    await act(async () => save?.click());

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "waitlist", reason: null }),
    );
  });
});
