import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DateFormatProvider, useDateFormat } from "./DateFormatContext";

function TestConsumer(): React.JSX.Element {
  const format = useDateFormat();
  return <div data-testid="format">{format}</div>;
}

describe("DateFormatContext", () => {
  it("defaults to DD/MM/YYYY when used outside any provider", () => {
    const html = renderToStaticMarkup(<TestConsumer />);
    expect(html).toContain("DD/MM/YYYY");
  });

  it("provides configured date format to child components", () => {
    const html = renderToStaticMarkup(
      <DateFormatProvider value="YYYY-MM-DD">
        <TestConsumer />
      </DateFormatProvider>,
    );
    expect(html).toContain("YYYY-MM-DD");
  });

  it("normalizes invalid date format strings to default format", () => {
    const html = renderToStaticMarkup(
      <DateFormatProvider value="INVALID_FORMAT">
        <TestConsumer />
      </DateFormatProvider>,
    );
    expect(html).toContain("DD/MM/YYYY");
  });

  it("accepts MM/DD/YYYY format cleanly", () => {
    const html = renderToStaticMarkup(
      <DateFormatProvider value="MM/DD/YYYY">
        <TestConsumer />
      </DateFormatProvider>,
    );
    expect(html).toContain("MM/DD/YYYY");
  });
});
