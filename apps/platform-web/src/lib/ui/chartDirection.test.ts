import { describe, expect, it } from "vitest";
import { chartDirection } from "./chartDirection";

describe("chartDirection", () => {
  it("keeps LTR charts in reading order", () => {
    expect(chartDirection(false)).toEqual({
      xAxisReversed: false,
      yAxisOrientation: "left",
      legendAlign: "left",
      legendDirection: "ltr",
    });
  });

  it("mirrors the axes and legend for RTL locales", () => {
    expect(chartDirection(true)).toEqual({
      xAxisReversed: true,
      yAxisOrientation: "right",
      legendAlign: "right",
      legendDirection: "rtl",
    });
  });
});
