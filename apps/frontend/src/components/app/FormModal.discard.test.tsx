import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormModal } from "./FormModal";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    title,
    children,
    onClose,
  }: {
    title?: React.ReactNode;
    children?: React.ReactNode;
    onClose: () => void;
  }) => (
    <div>
      <h2>{title}</h2>
      <button type="button" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="discard-dialog">{title}</div> : null,
}));

vi.mock("@/components/app/useFormModalLayout", () => ({
  useFormModalLayout: () => ({
    panelClassName: undefined,
    effectiveSize: "md",
    resolvedHeaderExtra: undefined,
    headerActions: undefined,
  }),
}));

describe("FormModal dirty discard", () => {
  it("renders without an open discard dialog when clean", () => {
    const html = renderToStaticMarkup(
      <FormModal open title="Edit" onClose={() => undefined} onSave={() => undefined}>
        <p>body</p>
      </FormModal>,
    );
    expect(html).toContain("Edit");
    expect(html).not.toContain('data-testid="discard-dialog"');
  });

  it("keeps discard dialog closed until close is requested while dirty", () => {
    const html = renderToStaticMarkup(
      <FormModal
        open
        title="Edit"
        onClose={() => undefined}
        onSave={() => undefined}
        isDirty
        discardUnsavedTitle="Discard?"
        discardUnsavedDescription="Unsaved"
      >
        <p>body</p>
      </FormModal>,
    );
    expect(html).toContain("Edit");
    expect(html).not.toContain("Discard?");
  });
});
