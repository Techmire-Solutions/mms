import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mapZodFormErrors } from "./mapZodFormErrors";

describe("mapZodFormErrors", () => {
  it("returns the first translated issue for each top-level field", () => {
    const schema = z.object({
      name: z.string().min(2, "name.short"),
      role: z.string().min(1, "role.required"),
    });
    const result = schema.safeParse({ name: "", role: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(mapZodFormErrors(result.error, (message) => `translated:${message}`)).toEqual({
        name: "translated:name.short",
        role: "translated:role.required",
      });
    }
  });
});
