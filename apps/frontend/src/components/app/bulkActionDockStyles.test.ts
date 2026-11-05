import { describe, expect, it } from "vitest";
import {
  bulkActionDockActionClassName,
  bulkActionDockDeleteClassName,
  bulkActionDockRestoreClassName,
} from "./bulkActionDockStyles";

describe("bulkActionDockStyles", () => {
  it("uses semantic tokens and the shared focus ring", () => {
    for (const token of [
      bulkActionDockActionClassName,
      bulkActionDockDeleteClassName,
      bulkActionDockRestoreClassName,
    ]) {
      expect(token).not.toMatch(/#[0-9a-f]{3,8}|\[[^\]]*#[^\]]*\]/i);
      expect(token).toContain("focus-visible:ring-offset-2");
      expect(token).toContain("focus-visible:ring-offset-background");
    }
    expect(bulkActionDockActionClassName).toContain("text-foreground");
    expect(bulkActionDockDeleteClassName).toContain("bg-destructive");
    expect(bulkActionDockRestoreClassName).toContain("text-primary");
  });
});
