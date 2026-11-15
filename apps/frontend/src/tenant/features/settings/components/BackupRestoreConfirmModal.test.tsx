import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import BackupRestoreConfirmModal from "./BackupRestoreConfirmModal";

describe("BackupRestoreConfirmModal", () => {
  it("renders the destructive FormModal footer and blocks restore until the phrase is typed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BackupRestoreConfirmModal
          open
          onClose={vi.fn()}
          summary={null}
          targetSubdomain="demo"
          confirmPhrase="RESTORE"
          onCreateSafetyBackup={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(document.querySelectorAll("button"));
    const restore = buttons.find((button) => button.textContent === "backup.confirmRestoreAction");
    const cancel = buttons.find((button) => button.textContent === "backup.confirmCancel");

    expect(restore).toBeInstanceOf(HTMLButtonElement);
    expect(restore?.disabled).toBe(true);
    expect(cancel).toBeInstanceOf(HTMLButtonElement);
    expect(document.querySelector("#backup-confirm-phrase")).toBeInstanceOf(HTMLInputElement);

    await act(async () => root.unmount());
    container.remove();
  });
});
