import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsPageConfirmDialogs } from "./ContactsPageConfirmDialogs.js";

vi.mock("@mms/fe-core/components/ModuleTrashConfirmDialogs", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  ModuleTrashConfirmDialogs: ({
    singleDeleteTitle,
    bulkDeleteTitle,
    bulkRestoreTitle,
  }: {
    singleDeleteTitle: string;
    bulkDeleteTitle: string;
    bulkRestoreTitle: string;
  }) => (
    <div data-testid="soft-delete-dialogs">
      <span>{singleDeleteTitle}</span>
      <span>{bulkDeleteTitle}</span>
      <span>{bulkRestoreTitle}</span>
    </div>
  ),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `${key}:${params.name}`;
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

describe("ContactsPageConfirmDialogs Component", () => {
  it("renders soft delete confirm dialogs with localized titles", () => {
    const html = renderToStaticMarkup(
      <ContactsPageConfirmDialogs
        bulkDeleteOpen={false}
        onBulkDeleteOpenChange={vi.fn()}
        selectedCount={2}
        onConfirmBulkDelete={vi.fn()}
        deleteTarget={{ id: "cnt-1", name: "Zayd Harith" }}
        onDeleteTargetOpenChange={vi.fn()}
        onConfirmSingleDelete={vi.fn()}
        bulkRestoreOpen={false}
        onBulkRestoreOpenChange={vi.fn()}
        onConfirmBulkRestore={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.deleteConfirmTitle");
    expect(html).toContain("contacts.bulkDelete");
    expect(html).toContain("contacts.bulkRestore");
  });
});
