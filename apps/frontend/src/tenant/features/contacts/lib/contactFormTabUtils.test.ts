import { describe, expect, it } from "vitest";
import type { ValidationError } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  buildContactValidationErrorItems,
  buildContactValidationErrorSummary,
} from "./contactFormTabUtils";

const t = ((key: string) => `t:${key}`) as unknown as TranslationFunction;

const errors: ValidationError[] = [
  { fieldId: "firstName", tabId: "basic", message: "First name is required" },
  { fieldId: "number", tabId: "phones", message: "Phone is required", index: 1 },
  // Duplicate of the first issue — the summary shows/moves to it once.
  { fieldId: "firstName", tabId: "basic", message: "First name is required" },
];

describe("buildContactValidationErrorItems", () => {
  it("keeps the tab, field and row index needed to focus each issue", () => {
    const items = buildContactValidationErrorItems(false, errors, t);

    expect(items).toEqual([
      { message: "First name is required", tabId: "basic", fieldId: "firstName", index: undefined },
      { message: "Phone is required", tabId: "phones", fieldId: "number", index: 1 },
    ]);
  });

  it("returns a single non-focusable item for a lookup load failure", () => {
    const items = buildContactValidationErrorItems(true, [], t);

    expect(items).toEqual([{ message: "t:contacts.form.lookupsLoadFailed" }]);
  });

  it("returns undefined when there is nothing to show", () => {
    expect(buildContactValidationErrorItems(false, [], t)).toBeUndefined();
    expect(buildContactValidationErrorItems(false, undefined, t)).toBeUndefined();
  });
});

describe("buildContactValidationErrorSummary", () => {
  it("maps the items to their deduped messages", () => {
    expect(buildContactValidationErrorSummary(false, errors, t)).toEqual([
      "First name is required",
      "Phone is required",
    ]);
  });
});
