import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsPageConfirmDialogs } from "./StudentsPageConfirmDialogs";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({
    open,
    title,
    description,
  }: {
    open: boolean;
    title: string;
    description: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    ) : null,
}));

const defaultProps = {
  bulkDeleteOpen: false,
  onBulkDeleteOpenChange: vi.fn(),
  selectedCount: 2,
  onConfirmBulkDelete: vi.fn(),
  deleteTarget: null,
  onDeleteTargetOpenChange: vi.fn(),
  onConfirmSingleDelete: vi.fn(),
  bulkRestoreOpen: false,
  onBulkRestoreOpenChange: vi.fn(),
  onConfirmBulkRestore: vi.fn(),
};

describe("StudentsPageConfirmDialogs Component", () => {
  it("renders single delete dialog when deleteTarget is set", () => {
    const html = renderToStaticMarkup(
      <StudentsPageConfirmDialogs
        {...defaultProps}
        deleteTarget={{ id: "std-1", name: "Zayd Harith" }}
      />,
    );

    expect(html).toContain("students.deleteConfirmTitle");
    expect(html).toContain("Zayd Harith");
  });

  it("renders bulk delete dialog when bulkDeleteOpen is true", () => {
    const html = renderToStaticMarkup(
      <StudentsPageConfirmDialogs {...defaultProps} bulkDeleteOpen={true} />,
    );

    expect(html).toContain("students.bulkDelete");
    expect(html).toContain("students.list.confirmRemoveSelected:2");
  });

  it("renders bulk restore dialog when bulkRestoreOpen is true", () => {
    const html = renderToStaticMarkup(
      <StudentsPageConfirmDialogs {...defaultProps} bulkRestoreOpen={true} />,
    );

    expect(html).toContain("students.bulkRestore");
    expect(html).toContain("students.bulkRestoreConfirm:2");
  });
});
