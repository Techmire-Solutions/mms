import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsPageHeaderActions } from "./StudentsPageHeaderActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StudentsPageHeaderActions Component", () => {
  it("renders export and add student buttons when canExport and canWrite are true", () => {
    const html = renderToStaticMarkup(
      <StudentsPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={false}
        onExport={vi.fn()}
        onAddStudent={vi.fn()}
      />,
    );

    expect(html).toContain("common.export");
    expect(html).toContain("action.addStudent");
  });

  it("renders import button when onImport is provided and canWrite is true", () => {
    const html = renderToStaticMarkup(
      <StudentsPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={false}
        onExport={vi.fn()}
        onAddStudent={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(html).toContain("common.import");
  });

  it("hides buttons when viewingDeleted is true", () => {
    const html = renderToStaticMarkup(
      <StudentsPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={true}
        onExport={vi.fn()}
        onAddStudent={vi.fn()}
      />,
    );

    expect(html).not.toContain("common.export");
    expect(html).not.toContain("action.addStudent");
  });
});
