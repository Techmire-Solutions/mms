import { describe, expect, it } from "vitest";
import { collectionSaveBodySchema } from "@mms/shared";
import type { z } from "zod";

/** Normalize a collection save body — mirrors the helper in dbCollectionRoutes. */
function normalizeCollectionSaveBody(body: z.infer<typeof collectionSaveBodySchema>): unknown[] {
  if (Array.isArray(body)) return body;
  return body.data;
}

describe("collectionSaveBodySchema", () => {
  it("accepts string lookup collections such as relationships", () => {
    const parsed = collectionSaveBodySchema.safeParse(["Mentor", "Mentee"]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(normalizeCollectionSaveBody(parsed.data)).toEqual(["Mentor", "Mentee"]);
    }
  });

  it("accepts object rows and { data } wrappers", () => {
    const objects = collectionSaveBodySchema.safeParse([{ country: "Pakistan", code: "+92" }]);
    expect(objects.success).toBe(true);

    const wrapped = collectionSaveBodySchema.safeParse({ data: ["Father", "Mother"] });
    expect(wrapped.success).toBe(true);
    if (wrapped.success) {
      expect(normalizeCollectionSaveBody(wrapped.data)).toEqual(["Father", "Mother"]);
    }
  });

  it("rejects non-array bodies and mixed invalid items", () => {
    expect(collectionSaveBodySchema.safeParse({ Mentor: true }).success).toBe(false);
    expect(collectionSaveBodySchema.safeParse("Mentor").success).toBe(false);
    expect(collectionSaveBodySchema.safeParse([42]).success).toBe(false);
  });
});
