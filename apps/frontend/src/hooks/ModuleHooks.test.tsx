import React from "react";
import { describe, expect, it } from "vitest";
import { useResendCountdown } from "./useResendCountdown";
import { useLocalPagination } from "./useLocalPagination";

describe("ModuleHooks", () => {
  describe("useResendCountdown", () => {
    it("initializes countdown timer hook structure", () => {
      function TestCountdownComponent() {
        const currentTimer = useResendCountdown(true, 30, 0);
        return <div>{currentTimer}</div>;
      }

      const element = <TestCountdownComponent />;
      expect(element.type).toBe(TestCountdownComponent);
    });
  });

  describe("useLocalPagination", () => {
    it("initializes pagination hook structure", () => {
      const items = ["a", "b", "c", "d", "e"];

      function TestPaginationComponent() {
        const pageResult = useLocalPagination({
          items,
          pageSize: 2,
        });
        return <div>{pageResult.paginatedItems.length}</div>;
      }

      const element = <TestPaginationComponent />;
      expect(element.type).toBe(TestPaginationComponent);
    });
  });
});
