import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJournalEntryActionsRenderer,
  createJournalNlHandlers,
} from "./journalEntriesControllerSelection";
import type { JournalEntry } from "@/lib/data/accountingData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/accounting/components/JournalEntryRowActions", () => ({
  JournalEntryRowActions: (props: any) => (
    <div data-testid="row-actions">
      <button data-testid="view-btn" onClick={() => props.onView(props.entry)}>
        View
      </button>
      <button data-testid="edit-btn" onClick={() => props.onEdit(props.entry)}>
        Edit
      </button>
      <button data-testid="post-btn" onClick={() => props.onPost(props.entry)}>
        Post
      </button>
      <button data-testid="reverse-btn" onClick={() => props.onReverse(props.entry)}>
        Reverse
      </button>
      <button data-testid="trash-btn" onClick={() => props.onTrashAction(props.entry.id)}>
        Trash
      </button>
    </div>
  ),
}));

const mockEntry: JournalEntry = {
  id: "entry-1",
  ref: "JE-001",
  date: "2026-09-01",
  description: "Test entry",
  status: "draft",
  created_by: "user-1",
  fiscal_year: "2026",
  tags: [],
  attachments: [],
  lines: [],
};

describe("journalEntriesControllerSelection", () => {
  describe("createJournalNlHandlers", () => {
    it("updates nlInput and sets nlSuggestion for query longer than 3 characters", () => {
      const setNlInput = vi.fn();
      const setNlSuggestion = vi.fn();
      const setSimpleModal = vi.fn();

      const { handleNlChange } = createJournalNlHandlers(
        "",
        setNlInput,
        setNlSuggestion,
        setSimpleModal,
      );
      handleNlChange("fee");
      expect(setNlInput).toHaveBeenCalledWith("fee");
      expect(setNlSuggestion).toHaveBeenCalledWith(null);

      handleNlChange("collect fee 500");
      expect(setNlInput).toHaveBeenCalledWith("collect fee 500");
      expect(setNlSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: "fee_collection" }),
      );
    });

    it("parses known natural language string and sets simple modal with prefillType and amount", () => {
      const setNlInput = vi.fn();
      const setNlSuggestion = vi.fn();
      const setSimpleModal = vi.fn();

      const { handleNlSubmit } = createJournalNlHandlers(
        "collect fee $250 from student",
        setNlInput,
        setNlSuggestion,
        setSimpleModal,
      );

      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
      handleNlSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(setSimpleModal).toHaveBeenCalledWith({
        prefillType: expect.objectContaining({ id: "fee_collection" }),
        initialAmount: "250",
        initialDescription: "collect fee $250 from student",
      });
      expect(setNlInput).toHaveBeenCalledWith("");
      expect(setNlSuggestion).toHaveBeenCalledWith(null);
    });

    it("handles unrecognized natural language string gracefully with prefillType: null", () => {
      const setNlInput = vi.fn();
      const setNlSuggestion = vi.fn();
      const setSimpleModal = vi.fn();

      const { handleNlSubmit } = createJournalNlHandlers(
        "misc note $80",
        setNlInput,
        setNlSuggestion,
        setSimpleModal,
      );

      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
      handleNlSubmit(mockEvent);

      expect(setSimpleModal).toHaveBeenCalledWith({
        prefillType: null,
        initialAmount: "80",
        initialDescription: "misc note $80",
      });
      expect(setNlInput).toHaveBeenCalledWith("");
      expect(setNlSuggestion).toHaveBeenCalledWith(null);
    });
  });

  describe("createJournalEntryActionsRenderer", () => {
    let container: HTMLDivElement;
    let root: Root;

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
    });

    it("renders row actions and wires callbacks appropriately", async () => {
      const setSelected = vi.fn();
      const setModal = vi.fn();
      const handlePost = vi.fn();
      const requestRowTrash = vi.fn();
      const handleReverse = vi.fn();

      const renderer = createJournalEntryActionsRenderer({
        canWrite: true,
        canDelete: true,
        showDeleted: false,
        setSelected,
        setModal,
        handlePost,
        requestRowTrash,
        handleReverse,
      });

      await act(async () => {
        root.render(<div>{renderer(mockEntry)}</div>);
      });

      const viewBtn = container.querySelector('[data-testid="view-btn"]') as HTMLButtonElement;
      const editBtn = container.querySelector('[data-testid="edit-btn"]') as HTMLButtonElement;
      const postBtn = container.querySelector('[data-testid="post-btn"]') as HTMLButtonElement;
      const reverseBtn = container.querySelector(
        '[data-testid="reverse-btn"]',
      ) as HTMLButtonElement;
      const trashBtn = container.querySelector('[data-testid="trash-btn"]') as HTMLButtonElement;

      expect(viewBtn).not.toBeNull();
      viewBtn.click();
      expect(setSelected).toHaveBeenCalledWith(mockEntry);
      expect(setModal).toHaveBeenCalledWith("view");

      editBtn.click();
      expect(setSelected).toHaveBeenCalledWith(mockEntry);
      expect(setModal).toHaveBeenCalledWith("edit");

      postBtn.click();
      expect(handlePost).toHaveBeenCalledWith(mockEntry);

      reverseBtn.click();
      expect(handleReverse).toHaveBeenCalledWith(mockEntry);

      trashBtn.click();
      expect(requestRowTrash).toHaveBeenCalledWith("entry-1");
    });
  });
});
