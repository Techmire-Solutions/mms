import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyPageConfirmDialogs } from "./FacultyPageConfirmDialogs";

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
  selectedCount: 3,
  onConfirmBulkDelete: vi.fn(),
  deleteTarget: null,
  onDeleteTargetOpenChange: vi.fn(),
  onConfirmSingleDelete: vi.fn(),
  bulkRestoreOpen: false,
  onBulkRestoreOpenChange: vi.fn(),
  onConfirmBulkRestore: vi.fn(),
};

describe("FacultyPageConfirmDialogs Component", () => {
  it("renders single delete dialog when deleteTarget is set", () => {
    const html = renderToStaticMarkup(
      <FacultyPageConfirmDialogs
        {...defaultProps}
        deleteTarget={{ id: "tch-1", name: "Ustadh Umar" }}
      />,
    );

    expect(html).toContain("faculty.confirmDeleteTitle");
    expect(html).toContain("Ustadh Umar");
  });

  it("renders bulk delete dialog when bulkDeleteOpen is true", () => {
    const html = renderToStaticMarkup(
      <FacultyPageConfirmDialogs {...defaultProps} bulkDeleteOpen={true} />,
    );

    expect(html).toContain("faculty.bulkDelete");
    expect(html).toContain("faculty.bulkDeleteConfirm:3");
  });

  it("renders bulk restore dialog when bulkRestoreOpen is true", () => {
    const html = renderToStaticMarkup(
      <FacultyPageConfirmDialogs {...defaultProps} bulkRestoreOpen={true} />,
    );

    expect(html).toContain("faculty.bulkRestore");
    expect(html).toContain("faculty.bulkRestoreConfirm:3");
  });
});
