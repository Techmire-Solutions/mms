import { describe, expect, it } from "vitest";
import * as deps from "../platform/deps.js";

describe("platform port contract", () => {
  it("declares every port function the module resolves", () => {
    const exported = Object.keys(deps)
      .filter((name) => name.startsWith("configure") === false)
      .filter((name) => name !== "platformPort" && name !== "PLATFORM_PORT_NAMES")
      .filter((name) => typeof (deps as Record<string, unknown>)[name] === "function");
    const missing = exported.filter(
      (name) => !(deps.PLATFORM_PORT_NAMES as readonly string[]).includes(name),
    );
    expect(missing).toEqual([]);
  });
});
