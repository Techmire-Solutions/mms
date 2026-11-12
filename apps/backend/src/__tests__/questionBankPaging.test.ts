import { describe, expect, it } from "vitest";
import { pagingWindow } from "../questionBank/use-cases/questionBankPaging.js";

describe("pagingWindow", () => {
  it("returns a bounded snapshot when no paging is requested", () => {
    expect(pagingWindow()).toEqual({ limit: 500, offset: 0 });
    expect(pagingWindow({ page: 3 })).toEqual({ limit: 500, offset: 1000 });
  });

  it("caps an explicit page size at 100", () => {
    expect(pagingWindow({ limit: 5000 })).toEqual({ limit: 100, offset: 0 });
    expect(pagingWindow({ page: 2, limit: 25 })).toEqual({ limit: 25, offset: 25 });
  });

  it("never returns a negative offset", () => {
    expect(pagingWindow({ page: 0, limit: 10 })).toEqual({ limit: 10, offset: 0 });
    expect(pagingWindow({ page: -5, limit: 0 })).toEqual({ limit: 1, offset: 0 });
  });
});
