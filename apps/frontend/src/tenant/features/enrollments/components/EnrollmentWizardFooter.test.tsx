import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { User, BookOpen } from "lucide-react";
import { EnrollmentWizardFooter } from "./EnrollmentWizardFooter";

describe("EnrollmentWizardFooter Component", () => {
  it("renders Next button when not on final step", () => {
    const html = renderToStaticMarkup(
      <EnrollmentWizardFooter
        t={((k: string) => k) as unknown as never}
        step={0}
        steps={[
          { id: "student", label: "Student", icon: User },
          { id: "session", label: "Session", icon: BookOpen },
        ]}
        canNext={true}
        canConfirm={false}
        submitting={false}
        onCancel={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("common.cancel");
    expect(html).toContain("common.next");
  });

  it("renders Submit button on final step", () => {
    const html = renderToStaticMarkup(
      <EnrollmentWizardFooter
        t={((k: string) => k) as unknown as never}
        step={1}
        steps={[
          { id: "student", label: "Student", icon: User },
          { id: "session", label: "Session", icon: BookOpen },
        ]}
        canNext={true}
        canConfirm={true}
        submitting={false}
        onCancel={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("common.previous");
    expect(html).toContain("enrollments.new");
  });
});
