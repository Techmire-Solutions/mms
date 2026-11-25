/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const directionalRule = require("../../eslint-rules/no-physical-directional-classes.cjs");

/**
 * Guards the BiDi rule itself.
 *
 * This rule is the machine enforcement behind the whole BiDi contract, and it had
 * two silent holes:
 *   1. It only read `className` literals, so `className={cn("pl-4")}` — the
 *      idiomatic style here — was never inspected.
 *   2. Its `\b`-delimited pattern matched the `right-2` inside
 *      `slide-in-from-right-2`, so widening the rule to `cn()` immediately
 *      produced false positives in the shadcn/Radix wrappers.
 * Both are locked in below.
 */
const linter = new Linter();

const config: Linter.Config[] = [
  {
    files: ["**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "mms-bidi": { rules: { "no-physical-directional-classes": directionalRule } },
    },
    rules: { "mms-bidi/no-physical-directional-classes": "error" },
  },
];

function lint(code: string): string[] {
  const messages = linter.verify(code, config, "probe.jsx");
  return messages
    .filter((m) => m.ruleId === "mms-bidi/no-physical-directional-classes")
    .map((m) => m.message.match(/`([^`]+)`/)?.[1] ?? m.message);
}

describe("no-physical-directional-classes", () => {
  it("reports physical classes in a plain className", () => {
    expect(lint(`export const A = () => <div className="pl-4 text-left" />;`)).toEqual([
      "pl-4",
      "text-left",
    ]);
  });

  it("reports physical classes inside cn(), including nested expressions", () => {
    const found = lint(
      `export const A = () => <div className={cn("flex pl-4", isOn && "mr-2", x ? "ml-1" : "pr-3")} />;`,
    );
    expect(found.sort()).toEqual(["ml-1", "mr-2", "pl-4", "pr-3"]);
  });

  it("reports each violation once (no duplicate from the two visitors)", () => {
    expect(lint(`export const A = () => <div className={cn("pl-4")} />;`)).toEqual(["pl-4"]);
  });

  it("reports clsx object-form keys and cva-style values", () => {
    expect(lint(`export const A = () => <div className={cn({ "border-l-2": isOn })} />;`)).toEqual([
      "border-l-2",
    ]);
    expect(lint(`const v = cva("base", { variants: { size: { sm: "text-right" } } });`)).toEqual([
      "text-right",
    ]);
  });

  it("reports composer calls made outside JSX", () => {
    expect(lint(`export const ROW = cn("p-2", isWide && "ml-3");`)).toEqual(["ml-3"]);
  });

  it("allows the logical equivalents", () => {
    expect(
      lint(
        `export const A = () => <div className={cn("ps-2", "pe-3", "ms-1", "me-1", "text-start", "text-end", "border-s-2", "rounded-e-lg", "start-0", "end-0")} />;`,
      ),
    ).toEqual([]);
  });

  it("does not flag longer utilities that merely contain a physical token", () => {
    // These are the shadcn/Radix popper enter animations: legitimately physical,
    // and the cause of 12 false positives when the rule first read cn().
    expect(
      lint(
        `export const A = () => <div className={cn("data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 rounded-lg")} />;`,
      ),
    ).toEqual([]);
  });

  it("still flags variant-prefixed physical classes", () => {
    expect(lint(`export const A = () => <div className="md:right-0 hover:text-left" />;`)).toEqual([
      "right-0",
      "text-left",
    ]);
  });
});
