import { describe, expect, it, vi } from "vitest";
import {
  createJournalPostHandler,
  createJournalSaveHandler,
  exportJournalEntriesCsv,
  formatJournalAmount,
} from "../lib/journalEntriesControllerActions";
import type { JournalEntry } from "@/lib/data/accountingData";
import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";

vi.mock("@/lib/backgroundJobs/runGridCsvExportJob", () => ({
  runGridCsvExportJob: vi.fn(),
}));

const mockEntry1: JournalEntry = {
  id: "entry-1",
  ref: "JE-001",
  date: "2026-09-01",
  description: "Test Entry 1",
  status: "draft",
  created_by: "user-1",
  fiscal_year: "2026",
  tags: ["Fees"],
  attachments: [],
  lines: [
    { id: "l1", account_id: "a1000", debit: 150, credit: 0, description: "Debit" },
    { id: "l2", account_id: "a4000", debit: 0, credit: 150, description: "Credit" },
  ],
};

const mockEntry2: JournalEntry = {
  id: "entry-2",
  ref: "JE-002",
  date: "2026-09-02",
  description: "Test Entry 2",
  status: "posted",
  created_by: "user-1",
  fiscal_year: "2026",
  tags: [],
  attachments: [],
  lines: [],
};

describe("journalEntriesControllerActions", () => {
  describe("createJournalSaveHandler", () => {
    it("appends new entry and closes modals when stayOpen is false", async () => {
      let state = [mockEntry1];
      const onChange = vi.fn(async (updater: (prev: JournalEntry[]) => JournalEntry[]) => {
        state = updater(state);
      });
      const setModal = vi.fn();
      const setSelected = vi.fn();
      const setSimpleModal = vi.fn();

      const handler = createJournalSaveHandler({ onChange, setModal, setSelected, setSimpleModal });
      await handler(mockEntry2, false);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(state).toHaveLength(2);
      expect(state[1]).toEqual(mockEntry2);
      expect(setModal).toHaveBeenCalledWith(null);
      expect(setSelected).toHaveBeenCalledWith(null);
      expect(setSimpleModal).toHaveBeenCalledWith(null);
    });

    it("replaces existing entry and does not close modals when stayOpen is true", async () => {
      let state = [mockEntry1];
      const onChange = vi.fn(async (updater: (prev: JournalEntry[]) => JournalEntry[]) => {
        state = updater(state);
      });
      const setModal = vi.fn();
      const setSelected = vi.fn();
      const setSimpleModal = vi.fn();

      const updatedEntry1: JournalEntry = { ...mockEntry1, description: "Updated Entry 1" };
      const handler = createJournalSaveHandler({ onChange, setModal, setSelected, setSimpleModal });
      await handler(updatedEntry1, true);

      expect(state).toHaveLength(1);
      expect(state[0]?.description).toBe("Updated Entry 1");
      expect(setModal).not.toHaveBeenCalled();
      expect(setSelected).not.toHaveBeenCalled();
      expect(setSimpleModal).not.toHaveBeenCalled();
    });
  });

  describe("createJournalPostHandler", () => {
    it("marks the matching entry status as posted", async () => {
      let state = [mockEntry1, mockEntry2];
      const onChange = vi.fn(async (updater: (prev: JournalEntry[]) => JournalEntry[]) => {
        state = updater(state);
      });

      const handler = createJournalPostHandler({ onChange });
      await handler(mockEntry1);

      expect(state.find((e) => e.id === "entry-1")?.status).toBe("posted");
      expect(state.find((e) => e.id === "entry-2")?.status).toBe("posted");
    });
  });

  describe("exportJournalEntriesCsv", () => {
    it("calls runGridCsvExportJob with formatted rows and columns", () => {
      const t = vi.fn((key: string) => key);
      exportJournalEntriesCsv([mockEntry1], t as unknown as never);

      expect(runGridCsvExportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "accounting",
          label: "accounting.journal.exportCurrentPageLabel",
          filename: "journal_entries_current_page.csv",
          columns: expect.arrayContaining([
            expect.objectContaining({ key: "ref" }),
            expect.objectContaining({ key: "debit" }),
            expect.objectContaining({ key: "credit" }),
          ]),
          rows: [
            {
              ref: "JE-001",
              date: "2026-09-01",
              description: "Test Entry 1",
              tags: "Fees",
              status: "draft",
              debit: "150",
              credit: "150",
            },
          ],
        }),
      );
    });
  });

  describe("formatJournalAmount", () => {
    it("uses custom formatCurrency if supplied", () => {
      const customFormat = vi.fn((n: number) => `Rs ${n}`);
      const result = formatJournalAmount(250, customFormat);
      expect(result).toBe("Rs 250");
      expect(customFormat).toHaveBeenCalledWith(250);
    });

    it("falls back to formatMoney from @mms/shared when formatCurrency is undefined", () => {
      const result = formatJournalAmount(500);
      expect(result).toBeTruthy();
    });
  });
});
