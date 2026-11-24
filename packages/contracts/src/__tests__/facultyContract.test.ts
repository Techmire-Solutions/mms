import { describe, expect, it } from "vitest";
import { facultyContract } from "../contracts/faculty.contract.js";

const fiveHundredIds = Array.from({ length: 500 }, (_, i) => `id-${i}`);
const fiveHundredOneIds = Array.from({ length: 501 }, (_, i) => `id-${i}`);

describe("Faculty bulk/resolve contract id caps", () => {
  it("bulkDelete accepts up to 500 ids and rejects > 500", () => {
    expect(facultyContract.bulkDelete.body.safeParse({ ids: fiveHundredIds }).success).toBe(true);
    expect(facultyContract.bulkDelete.body.safeParse({ ids: fiveHundredOneIds }).success).toBe(
      false,
    );
  });

  it("bulkRestore accepts up to 500 ids and rejects > 500", () => {
    expect(facultyContract.bulkRestore.body.safeParse({ ids: fiveHundredIds }).success).toBe(true);
    expect(facultyContract.bulkRestore.body.safeParse({ ids: fiveHundredOneIds }).success).toBe(
      false,
    );
  });

  it("resolve rejects > 500 ids", () => {
    expect(facultyContract.resolve.body.safeParse({ ids: fiveHundredOneIds }).success).toBe(false);
  });
});
