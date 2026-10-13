import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/lib/data/accountingData";
import { useJournalEntryForm } from "../hooks/useJournalEntryForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    // Key identity keeps the assertions about which validation message fired.
    t: (key: string) => key,
    isLoading: false,
    dir: "ltr",
    isRtl: false,
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Tester" } }),
}));

const accounts = [
  {
    id: "a-cash",
    code: "1000",
    name: "Cash",
    type: "Asset" as const,
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-income",
    code: "4000",
    name: "Income",
    type: "Revenue" as const,
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
];

type FormController = ReturnType<typeof useJournalEntryForm>;

function TestHarness(props: {
  onSave: (entry: JournalEntry) => void | Promise<void>;
  onController: (controller: FormController) => void;
  entries?: JournalEntry[];
  initial?: JournalEntry | null;
}) {
  const controller = useJournalEntryForm({
    accounts,
    entries: props.entries ?? [],
    initial: props.initial ?? null,
    fiscalYears: [],
    onSave: props.onSave,
  });
  props.onController(controller);
  return null;
}

describe("useJournalEntryForm validation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: FormController | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    controller = undefined;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  /** Fill narration + two accounts with the given amounts (disjoint draft). */
  const fillEntry = async (debit: string, credit: string) => {
    await act(async () => {
      controller!.setForm((current) => ({
        ...current,
        description: "Test entry",
        lines: [
          { ...current.lines[0]!, account_id: "a-cash", debit, credit: "" },
          { ...current.lines[1]!, account_id: "a-income", debit: "", credit },
        ],
      }));
    });
  };

  it("saves an unbalanced entry as a draft", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("100", "60");

    await act(async () => {
      await controller!.saveEntry("draft");
    });

    expect(controller!.errors.balance).toBeUndefined();
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as JournalEntry;
    expect(saved.status).toBe("draft");
    expect(saved.lines.map((line) => [line.debit, line.credit])).toEqual([
      [100, 0],
      [0, 60],
    ]);
  });

  it("refuses to post an unbalanced entry", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("100", "60");

    await act(async () => {
      await controller!.saveEntry("posted");
    });

    expect(controller!.errors.balance).toBe("accounting.journal.form.errorBalance");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("still requires two accounts before saving a draft", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await act(async () => {
      controller!.setForm((current) => ({
        ...current,
        description: "Only one account",
        lines: [
          { ...current.lines[0]!, account_id: "a-cash", debit: "100", credit: "" },
          { ...current.lines[1]!, account_id: "", debit: "", credit: "" },
        ],
      }));
    });

    await act(async () => {
      await controller!.saveEntry("draft");
    });

    expect(controller!.errors.lines).toBe("accounting.journal.form.errorLines");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("posts a balanced entry", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("0.1", "0.1");

    await act(async () => {
      await controller!.saveEntry("posted");
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0]![0] as JournalEntry).status).toBe("posted");
  });

  it("reports totals as exact money", async () => {
    await act(async () => {
      root.render(
        <TestHarness
          onSave={vi.fn()}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await act(async () => {
      controller!.setForm((current) => ({
        ...current,
        lines: [
          { ...current.lines[0]!, account_id: "a-cash", debit: "0.1", credit: "" },
          { ...current.lines[1]!, account_id: "a-income", debit: "0.2", credit: "" },
          { ...current.lines[1]!, id: "l-3", account_id: "a-income", debit: "", credit: "0.3" },
        ],
      }));
    });

    expect(String(controller!.totalDebit)).toBe("0.3");
    expect(controller!.isBalanced).toBe(true);
  });

  it("preserves custom reference number and custom tags", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("50", "50");

    await act(async () => {
      controller!.setForm((current) => ({
        ...current,
        ref: "CUSTOM-VOUCHER-001",
        tags: ["BuildingFund", "Cash"],
      }));
    });

    await act(async () => {
      await controller!.saveEntry("posted");
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as JournalEntry;
    expect(saved.ref).toBe("CUSTOM-VOUCHER-001");
    expect(saved.tags).toEqual(["BuildingFund", "Cash"]);
  });

  it("handles comma-separated amounts in journal entry lines without NaN", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("1,500", "1,500");

    expect(controller!.totalDebit).toBe(1500);
    expect(controller!.totalCredit).toBe(1500);
    expect(controller!.isBalanced).toBe(true);

    await act(async () => {
      await controller!.saveEntry("posted");
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as JournalEntry;
    expect(saved.lines[0]!.debit).toBe(1500);
    expect(saved.lines[1]!.credit).toBe(1500);
  });

  it("rejects duplicate reference when another entry already uses it", async () => {
    const existingEntry: JournalEntry = {
      id: "je-existing",
      ref: "JE-0001",
      date: "2026-03-01",
      description: "Existing entry",
      status: "posted",
      created_by: "system",
      fiscal_year: "FY 2026",
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "a-cash", debit: 50, credit: 0, description: "" },
        { id: "l2", account_id: "a-income", debit: 0, credit: 50, description: "" },
      ],
    };

    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          entries={[existingEntry]}
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });
    await fillEntry("50", "50");

    await act(async () => {
      controller!.setForm((current) => ({
        ...current,
        ref: "JE-0001",
      }));
    });

    await act(async () => {
      await controller!.saveEntry("draft");
    });

    expect(controller!.errors.ref).toBe("accounting.journal.form.errorRefDuplicate");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("allows keeping the same reference when editing an existing entry", async () => {
    const existingEntry: JournalEntry = {
      id: "je-existing",
      ref: "JE-0001",
      date: "2026-03-01",
      description: "Existing entry",
      status: "draft",
      created_by: "system",
      fiscal_year: "FY 2026",
      tags: [],
      attachments: [],
      lines: [
        { id: "l1", account_id: "a-cash", debit: 50, credit: 0, description: "" },
        { id: "l2", account_id: "a-income", debit: 0, credit: 50, description: "" },
      ],
    };

    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <TestHarness
          entries={[existingEntry]}
          initial={existingEntry}
          onSave={onSave}
          onController={(c) => {
            controller = c;
          }}
        />,
      );
    });

    await act(async () => {
      await controller!.saveEntry("draft");
    });

    expect(controller!.errors.ref).toBeUndefined();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
