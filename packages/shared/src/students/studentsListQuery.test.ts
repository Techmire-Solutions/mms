import { describe, expect, it } from "vitest";
import { studentsListQuerySchema } from "./studentsListQuery.js";

describe("studentsListQuery", () => {
  it("parses bounded sibling relationship filters", () => {
    expect(
      studentsListQuerySchema.parse({
        page: "1",
        limit: "100",
        relatedContactIds: "father-1,guardian-1",
        fatherName: "Ahmed Ali",
        excludeId: "student-1",
      }),
    ).toMatchObject({
      page: 1,
      limit: 100,
      relatedContactIds: "father-1,guardian-1",
      fatherName: "Ahmed Ali",
      excludeId: "student-1",
    });
  });
});
