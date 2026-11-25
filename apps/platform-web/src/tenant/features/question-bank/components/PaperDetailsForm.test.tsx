import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { PaperConfig } from "@/tenant/features/question-bank/lib/paperBuilderUtils";
import { PaperDetailsForm } from "./PaperDetailsForm";

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("@/components/common/SessionClassSectionSelect", () => ({
  sessionIdForClass: () => "",
  SessionClassSectionSelect: () => <div data-testid="session-class-section" />,
}));

const config: PaperConfig = {
  name: "",
  examClass: "",
  classId: "",
  duration: 60,
  totalMarks: 100,
  instructions: "",
};

describe("PaperDetailsForm", () => {
  it("renders write-schema errors on the owned fields", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PaperDetailsForm
          config={config}
          onChange={vi.fn()}
          errors={{ name: "Name is required", duration: "Duration must be positive" }}
        />,
      );
    });

    expect(container.textContent).toContain("Name is required");
    expect(container.textContent).toContain("Duration must be positive");

    await act(async () => root.unmount());
    container.remove();
  });
});
