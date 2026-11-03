import { describe, expect, it, vi } from "vitest";
import { readIncludeDeletedSetting, withIncludeDeletedScope } from "../lib/softDeleteHelpers.js";

type QueryChunk = string | { value?: unknown };

/**
 * Renders a Drizzle `sql` template for the fake connection.
 * Drizzle emits literals as StringChunks (`value: string[]`), inline string bindings as boxed
 * `String` chunks, and other bindings as Params (`value: scalar`).
 */
function renderQuery(query: unknown): { text: string; params: unknown[] } {
  const chunks = (query as { queryChunks?: QueryChunk[] })?.queryChunks ?? [];
  let text = "";
  const params: unknown[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === "string") {
      text += chunk;
      continue;
    }
    if (chunk instanceof String) {
      text += String(chunk);
      continue;
    }
    const value = chunk && typeof chunk === "object" ? chunk.value : undefined;
    if (Array.isArray(value)) {
      text += value.join("");
      continue;
    }
    if (chunk && typeof chunk === "object" && "value" in chunk) {
      text += "?";
      params.push(value);
    }
  }
  return { text, params };
}

/** Extracts the value passed to `set_config('app.include_deleted', <value>, true)`. */
function readSetConfigValue(text: string, params: unknown[]): string | null {
  // Drizzle inlines literal values quoted (`'true'`) and string bindings bare (`false`).
  const inlined = /set_config\('app\.include_deleted',\s*'?([A-Za-z]+)'?/.exec(text);
  if (inlined) return inlined[1] ?? null;
  return params[0] == null ? null : String(params[0]);
}

/** Minimal transaction double that models the `app.include_deleted` GUC. */
function createFakeTx(initial: string | null) {
  const state = { current: initial, history: [] as Array<string | null> };
  const tx = {
    execute: vi.fn(async (query: unknown) => {
      const { text, params } = renderQuery(query);
      if (text.includes("current_setting")) {
        return { rows: [{ value: state.current }] };
      }
      if (text.includes("set_config")) {
        state.current = readSetConfigValue(text, params);
        state.history.push(state.current);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { tx, state };
}

describe("withIncludeDeletedScope", () => {
  it("enables deleted-row visibility for the work only, then restores 'false'", async () => {
    const { tx, state } = createFakeTx(null);
    let observedDuringWork: string | null = "unset";

    await withIncludeDeletedScope(tx, async () => {
      observedDuringWork = state.current;
    });

    expect(observedDuringWork).toBe("true");
    expect(state.current).toBe("false");
  });

  it("keeps a caller that had already opted into deleted rows", async () => {
    const { tx, state } = createFakeTx("true");

    await withIncludeDeletedScope(tx, async () => undefined);

    expect(state.current).toBe("true");
  });

  it("restores the previous scope when the work throws", async () => {
    const { tx, state } = createFakeTx(null);

    await expect(
      withIncludeDeletedScope(tx, async () => {
        throw new Error("count failed");
      }),
    ).rejects.toThrow("count failed");

    expect(state.current).toBe("false");
  });

  it("runs the work unchanged when the client cannot execute SQL", async () => {
    const work = vi.fn(async () => "done");

    await expect(withIncludeDeletedScope({}, work)).resolves.toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("readIncludeDeletedSetting", () => {
  it("returns null for a client without execute", async () => {
    await expect(readIncludeDeletedSetting({})).resolves.toBeNull();
  });

  it("returns the current transaction-local value", async () => {
    const { tx } = createFakeTx("true");
    await expect(readIncludeDeletedSetting(tx)).resolves.toBe("true");
  });
});
