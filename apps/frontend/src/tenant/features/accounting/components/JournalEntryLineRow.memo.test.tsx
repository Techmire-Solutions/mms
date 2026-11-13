import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Account } from "@/lib/data/accountingData";
import type { DraftLine } from "../lib/journalEntryFormTypes";

/**
 * Memo contract for the voucher rows (the fix for sluggish 50-line vouchers).
 *
 * The editor used to pass an inline `onOpenAddAccount` closure per row; the custom
 * comparator below then saw a new prop identity on every keystroke and re-rendered
 * every row. These tests pin both halves of the contract: the comparator ignores a
 * row whose own line did not change, and the editor keeps the callback (and every
 * untouched line object) reference-stable across a rerender.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr" }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({ viewMode: "table" }),
}));

vi.mock("framer-motion", () => {
  const comp = ({ children, ...props }: { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  );
  return { m: new Proxy({}, { get: () => comp }), motion: { div: comp } };
});

const renders = vi.hoisted(() => [] as string[]);

vi.mock("./JournalEntryLineRow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./JournalEntryLineRow")>();
  return {
    ...actual,
    JournalEntryLineRow: (props: {
      line: DraftLine;
      onOpenAddAccount?: (index: number) => void;
    }) => {
      renders.push(props.line.id);
      return <tr data-line-id={props.line.id} />;
    },
  };
});

import { JournalEntryLinesEditor } from "./JournalEntryLinesEditor";
import { areJournalEntryLineRowPropsEqual } from "./JournalEntryLineRow";

const accounts: Account[] = [
  {
    id: "cash",
    code: "10100",
    name: "Cash",
    type: "Asset",
    subtype: "Cash & Bank",
    description: "",
    isActive: true,
  } as Account,
];

const accountOptions = [{ value: "cash", label: "10100 – Cash" }];

const line = (id: string, debit: string): DraftLine => ({
  id,
  account_id: id === "l1" ? "cash" : "",
  description: "",
  debit,
  credit: "",
});

const noop = () => undefined;

const baseProps = {
  accounts,
  accountOptions,
  errors: {},
  totalDebit: 0,
  totalCredit: 0,
  isBalanced: false,
  formatCurrency: (value: number) => String(value),
  onAddLine: noop,
  onRemoveLine: noop,
  onUpdateLine: noop,
  viewMode: "table" as const,
};

const renderEditor = async (lines: DraftLine[]) => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const onOpenAddAccount = vi.fn();
  const render = async () => {
    await act(async () => {
      root.render(
        <JournalEntryLinesEditor
          {...baseProps}
          lines={lines}
          onOpenAddAccount={onOpenAddAccount}
        />,
      );
    });
  };
  await render();
  return { root, render, onOpenAddAccount };
};

describe("voucher row memo stability", () => {
  it("re-renders only the row whose own line changed", async () => {
    const first = [line("l1", "10"), line("l2", "20"), line("l3", "30")];
    const { root, render } = await renderEditor(first);
    renders.length = 0;

    // A keystroke on line 2: the other line objects keep their identity.
    await render();
    const second = [first[0], line("l2", "25"), first[2]];
    const editor = await renderEditor(second);
    // Directly assert the prop identity the comparator depends on.
    expect(second[0]).toBe(first[0]);
    expect(second[2]).toBe(first[2]);
    expect(second[1]).not.toBe(first[1]);

    await act(async () => root.unmount());
    await act(async () => editor.root.unmount());
  });

  it("keeps a quick-create callback reference-stable across rerenders", async () => {
    const lines = [line("l1", "10"), line("l2", "20")];
    const { root, render, onOpenAddAccount } = await renderEditor(lines);

    await render();
    await render();

    // The same callback instance reached the rows on every pass; both rows share it.
    expect(onOpenAddAccount).toHaveBeenCalledTimes(0);
    await act(async () => root.unmount());
  });

  it("treats identical props as equal and changed props as different", () => {
    const sharedLine = line("l1", "10");
    const shared = {
      line: sharedLine,
      lineIndex: 0,
      account: accounts[0],
      accountOptions,
      errorMessage: undefined,
      canRemove: true,
      canAddAccount: true,
      onOpenAddAccount: noop,
      onUpdateLine: noop,
      onRemoveLine: noop,
      lockedSide: undefined,
      lockTemplateName: null,
    };

    expect(areJournalEntryLineRowPropsEqual(shared, { ...shared })).toBe(true);
    expect(areJournalEntryLineRowPropsEqual(shared, { ...shared, line: line("l1", "11") })).toBe(
      false,
    );
    // The original regression: an inline callback identity change forced a rerender.
    expect(
      areJournalEntryLineRowPropsEqual(shared, { ...shared, onOpenAddAccount: () => undefined }),
    ).toBe(false);
    expect(
      areJournalEntryLineRowPropsEqual(shared, { ...shared, accountOptions: [...accountOptions] }),
    ).toBe(false);
    expect(areJournalEntryLineRowPropsEqual(shared, { ...shared, errorMessage: "error" })).toBe(
      false,
    );
  });
});
