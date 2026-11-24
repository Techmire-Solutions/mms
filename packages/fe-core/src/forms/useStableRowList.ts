import { useState } from "react";

export interface StableRow<T> {
  id: string;
  value: T;
}

interface UseStableRowListOptions<T> {
  /** Controlled values from the owning form draft. */
  values: readonly T[];
  /** Emits the next values after any row operation. */
  onChange: (values: T[]) => void;
  /** Factory for a newly appended row. */
  createValue: () => T;
  /** Order-sensitive identity of the values; an external change rebuilds rows with fresh ids. */
  serialize: (values: readonly T[]) => string;
}

function newRowId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Stable React keys for controlled repeatable form rows.
 *
 * Row values still come from the form draft (single source of truth), but each
 * rendered row carries an id that travels with its value through append/remove/
 * move. Keys therefore never derive from the array index, so removing or
 * reordering a row cannot shift values/focus onto a different input.
 *
 * The draft is re-seeded with fresh ids only when its serialized content no
 * longer matches the local rows (record/type switch, upload, external reset).
 * This is the same render-phase adjustment pattern as `useIdentityReset`.
 */
export function useStableRowList<T>({
  values,
  onChange,
  createValue,
  serialize,
}: UseStableRowListOptions<T>): {
  rows: readonly StableRow<T>[];
  append: () => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  updateAt: (index: number, updater: (value: T) => T) => void;
  replaceAt: (index: number, value: T) => void;
} {
  const [rows, setRows] = useState<StableRow<T>[]>(() =>
    values.map((value) => ({ id: newRowId(), value })),
  );

  if (serialize(rows.map((row) => row.value)) !== serialize(values)) {
    // External reset (different record/type/loaded draft): adopt the new values.
    setRows(values.map((value) => ({ id: newRowId(), value })));
  }

  const commit = (nextRows: StableRow<T>[]): void => {
    setRows(nextRows);
    onChange(nextRows.map((row) => row.value));
  };

  const append = (): void => {
    commit([...rows, { id: newRowId(), value: createValue() }]);
  };

  const removeAt = (index: number): void => {
    if (index < 0 || index >= rows.length) return;
    commit(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const move = (from: number, to: number): void => {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const nextRows = [...rows];
    const [row] = nextRows.splice(from, 1);
    if (!row) return;
    nextRows.splice(to, 0, row);
    commit(nextRows);
  };

  const updateAt = (index: number, updater: (value: T) => T): void => {
    if (index < 0 || index >= rows.length) return;
    commit(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { id: row.id, value: updater(row.value) } : row,
      ),
    );
  };

  const replaceAt = (index: number, value: T): void => {
    updateAt(index, () => value);
  };

  return { rows, append, removeAt, move, updateAt, replaceAt };
}
