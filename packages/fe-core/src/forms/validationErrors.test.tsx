import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { FieldErrors } from "react-hook-form";
import { toValidationErrors, firstValidationErrorMessage } from "./validationErrors";
import {
  createZodFormResolver,
  readValidationErrors,
  VALIDATION_ERRORS_KEY,
} from "./createZodFormResolver";
import { useDraftBaseline } from "./useDraftBaseline";

const schema = z.object({
  name: z.string().min(1, "nameRequired"),
  phones: z.array(z.object({ number: z.string().min(1, "phoneRequired") })),
});

function parseError(value: unknown): z.ZodError {
  const result = schema.safeParse(value);
  if (result.success) throw new Error("expected a parse failure");
  return result.error;
}

describe("toValidationErrors", () => {
  it("maps a plain field issue to fieldId/tabId/message", () => {
    const errors = toValidationErrors(parseError({ name: "", phones: [] }));
    expect(errors).toEqual([{ fieldId: "name", tabId: "basic", message: "nameRequired" }]);
  });

  it("routes list-item issues to their tab and carries the index", () => {
    const errors = toValidationErrors(parseError({ name: "ok", phones: [{ number: "" }] }), {
      resolveTabId: (fieldId) => (fieldId === "phones" ? "phones" : undefined),
    });
    expect(errors).toEqual([
      { fieldId: "number", tabId: "phones", message: "phoneRequired", index: 0 },
    ]);
  });

  it("applies resolveMessage", () => {
    const errors = toValidationErrors(parseError({ name: "", phones: [] }), {
      resolveMessage: (message) => `t:${message}`,
    });
    expect(errors[0].message).toBe("t:nameRequired");
  });
});

describe("firstValidationErrorMessage", () => {
  it("returns the first resolvable message, or empty when none", () => {
    expect(
      firstValidationErrorMessage(
        [{ fieldId: "a", tabId: "basic", message: "k" }],
        (m) => `t:${m}`,
      ),
    ).toBe("t:k");
    expect(firstValidationErrorMessage([], (m) => m)).toBe("");
    expect(firstValidationErrorMessage(undefined, (m) => m)).toBe("");
  });
});

describe("createZodFormResolver", () => {
  it("passes valid values through with no errors", async () => {
    const resolver = createZodFormResolver(schema);
    const result = await resolver({ name: "ok", phones: [] } as never, undefined, {} as never);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ name: "ok", phones: [] });
  });

  it("returns RHF field errors and the identical ValidationError[] shape", async () => {
    const resolver = createZodFormResolver(schema);
    const values = { name: "", phones: [{ number: "" }] };
    const result = await resolver(values as never, undefined, {} as never);

    const rhfErrors = result.errors as unknown as {
      name?: { message?: string };
      phones?: Array<{ number?: { message?: string } }>;
    };
    expect(rhfErrors.name?.message).toBe("nameRequired");
    expect(rhfErrors.phones?.[0]?.number?.message).toBe("phoneRequired");

    const structured = readValidationErrors(result.errors as FieldErrors<typeof values>);
    expect(structured).toEqual(toValidationErrors(parseError(values)));
    expect((result.errors as unknown as Record<string, unknown>)[VALIDATION_ERRORS_KEY]).toEqual(
      structured,
    );
  });

  it("normalizes field messages through resolveMessage", async () => {
    const resolver = createZodFormResolver(schema, { resolveMessage: (m) => `t:${m}` });
    const result = await resolver({ name: "", phones: [] } as never, undefined, {} as never);
    const rhfErrors = result.errors as unknown as { name?: { message?: string } };
    expect(rhfErrors.name?.message).toBe("t:nameRequired");
  });
});

interface Draft {
  name: string;
  id?: string;
}

const draftSnapshot = (draft: Draft): string => JSON.stringify({ name: draft.name ?? "" });

function Harness({ draft }: { draft: Draft }): React.JSX.Element {
  const { isDirty, resetBaseline } = useDraftBaseline(draft, draftSnapshot);
  return (
    <button type="button" data-dirty={String(isDirty)} onClick={() => resetBaseline()}>
      reset
    </button>
  );
}

describe("useDraftBaseline", () => {
  it("tracks dirtiness against the initial baseline, ignores volatile keys, and resets", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = (draft: Draft) =>
      act(() => {
        root.render(<Harness draft={draft} />);
      });
    const dirty = () => container.querySelector("button")?.getAttribute("data-dirty");

    render({ name: "a", id: "x" });
    expect(dirty()).toBe("false");

    // Volatile key `id` change must not dirty the draft.
    render({ name: "a", id: "y" });
    expect(dirty()).toBe("false");

    render({ name: "b", id: "y" });
    expect(dirty()).toBe("true");

    act(() => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    render({ name: "b", id: "y" });
    expect(dirty()).toBe("false");
  });
});
