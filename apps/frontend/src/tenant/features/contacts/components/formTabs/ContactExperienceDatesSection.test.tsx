import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactExperienceDatesSection } from "./ContactExperienceDatesSection";
import type { ContactExperience } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactExperienceDatesSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockExp: ContactExperience = {
    title: "Software Engineer",
    organization: "Tech Corp",
    startDate: "2024-01-01",
    endDate: "2025-01-01",
    isCurrent: false,
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("returns null when all date fields are hidden", async () => {
    await act(async () => {
      root.render(
        <ContactExperienceDatesSection
          exp={mockExp}
          idx={0}
          formInstanceId="form-1"
          showStartDate={false}
          showEndDate={false}
          showIsCurrent={false}
          isFieldRequired={() => false}
          onUpdate={vi.fn()}
        />,
      );
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders date fields and triggers update on checkbox change", async () => {
    const onUpdate = vi.fn();

    await act(async () => {
      root.render(
        <ContactExperienceDatesSection
          exp={mockExp}
          idx={0}
          formInstanceId="form-1"
          showStartDate={true}
          showEndDate={true}
          showIsCurrent={true}
          isFieldRequired={() => false}
          onUpdate={onUpdate}
        />,
      );
    });

    expect(container.textContent).toContain("contacts.fields.experienceStartDate");
    expect(container.textContent).toContain("contacts.fields.experienceEndDate");
    expect(container.textContent).toContain("contacts.form.currentlyWorkingHere");

    const checkbox = container.querySelector("button[role='checkbox']");
    expect(checkbox).toBeDefined();

    await act(async () => {
      (checkbox as HTMLButtonElement)?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith({
      isCurrent: true,
      endDate: "",
    });
  });
});
