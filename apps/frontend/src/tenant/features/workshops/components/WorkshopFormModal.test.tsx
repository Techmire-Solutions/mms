import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopEvent } from "@mms/shared";
import { WorkshopFormModal } from "./WorkshopFormModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));

const workshop = (fields: Partial<WorkshopEvent> = {}): WorkshopEvent => ({
  id: "w1",
  title: "Calligraphy",
  description: "Basics",
  startDate: "2099-03-01",
  endDate: "2099-03-02",
  registrationDeadline: null,
  capacity: 20,
  fee: 1500,
  programId: null,
  subjectId: null,
  participantCount: 0,
  ...fields,
});

function saveButton(): HTMLButtonElement | undefined {
  const buttons = Array.from(document.querySelectorAll("button"));
  return buttons.find((b) => b.textContent?.includes("common.save")) ?? buttons.at(-1);
}

describe("WorkshopFormModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSave = vi.fn();

  const render = (initialData: WorkshopEvent | null) =>
    act(async () => {
      root.render(
        <WorkshopFormModal open onClose={onClose} initialData={initialData} onSave={onSave} />,
      );
    });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose.mockClear();
    onSave.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("given an existing workshop, should prefill and save numbers and dates", async () => {
    // Arrange
    await render(workshop());
    expect(document.querySelector<HTMLInputElement>("#workshop-title")?.value).toBe("Calligraphy");

    // Act
    await act(async () => saveButton()?.click());

    // Assert
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Calligraphy",
        startDate: "2099-03-01",
        endDate: "2099-03-02",
        capacity: 20,
        fee: 1500,
        registrationDeadline: null,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("given an end before the start, should show the translated rule and not save", async () => {
    // Arrange
    await render(workshop({ endDate: "2099-02-01" }));

    // Act
    await act(async () => saveButton()?.click());

    // Assert
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("workshops.validation.endBeforeStart");
  });

  it("given a failing save, should keep the modal open with the error", async () => {
    // Arrange
    onSave.mockRejectedValueOnce(new Error("This workshop is full"));
    await render(workshop());

    // Act
    await act(async () => saveButton()?.click());

    // Assert
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("This workshop is full");
  });
});
