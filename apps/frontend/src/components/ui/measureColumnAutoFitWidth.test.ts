import { describe, expect, it } from "vitest";
import { measureColumnAutoFitWidth } from "./measureColumnAutoFitWidth";
import { MODULE_COLUMN_WIDTH_MIN } from "@mms/shared";

describe("measureColumnAutoFitWidth", () => {
  it("returns minWidth when thElement is null", () => {
    expect(measureColumnAutoFitWidth(null)).toBe(MODULE_COLUMN_WIDTH_MIN);
    expect(measureColumnAutoFitWidth(null, 120, 500)).toBe(120);
  });

  it("measures table header and cells and clamps within min and max", () => {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const th1 = document.createElement("th");
    th1.textContent = "User Name";
    const th2 = document.createElement("th");
    th2.textContent = "Email";
    headerRow.appendChild(th1);
    headerRow.appendChild(th2);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const row1 = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = "Muhammad Abdullah Al-Mansoor";
    const td2 = document.createElement("td");
    td2.textContent = "user@example.com";
    row1.appendChild(td1);
    row1.appendChild(td2);
    tbody.appendChild(row1);
    table.appendChild(tbody);

    document.body.appendChild(table);

    const width = measureColumnAutoFitWidth(th1, 80, 400);
    expect(width).toBeGreaterThanOrEqual(80);
    expect(width).toBeLessThanOrEqual(400);

    table.remove();
  });
});
