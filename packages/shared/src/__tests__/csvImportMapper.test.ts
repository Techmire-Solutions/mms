import { describe, it, expect } from "vitest";
import { mapCsvGridToObjects } from "../core/csvImportMapper.js";
import { generateCsvTemplate } from "../core/csvTemplateGenerator.js";

describe("csvImportMapper", () => {
  it("maps grid rows to object keys with case and punctuation insensitivity", () => {
    const grid = [
      ["Full Name", "Email Address", "Phone Number"],
      ["Ahmed Khan", "ahmed@example.com", "1234567890"],
      ["Fatima Ali", "fatima@example.com", "9876543210"],
    ];

    const mappings = [
      { key: "name", header: "full_name" },
      { key: "email", header: "Email", aliases: ["Email Address"] },
      { key: "phone", header: "Phone Number" },
    ];

    const result = mapCsvGridToObjects(grid, mappings);

    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      name: "Ahmed Khan",
      email: "ahmed@example.com",
      phone: "1234567890",
    });
  });

  it("recognizes aliases when primary header is not present", () => {
    const grid = [
      ["Student ID", "Guardian Phone"],
      ["STU-001", "+923001234567"],
    ];

    const mappings = [
      { key: "id", header: "ID", aliases: ["Student ID", "Admission No"] },
      { key: "phone", header: "Phone", aliases: ["Guardian Phone", "Contact"] },
    ];

    const result = mapCsvGridToObjects(grid, mappings);

    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rows).toEqual([{ id: "STU-001", phone: "+923001234567" }]);
  });

  it("reports missing required headers", () => {
    const grid = [
      ["Name", "Age"],
      ["Zaid", "25"],
    ];

    const mappings = [
      { key: "name", header: "Name", required: true },
      { key: "email", header: "Email", required: true },
    ];

    const result = mapCsvGridToObjects(grid, mappings);

    expect(result.missingHeaders).toEqual(["Email"]);
    expect(result.rows).toHaveLength(0);
  });

  it("runs field transformation and catches row transform errors", () => {
    const grid = [
      ["Name", "Age"],
      ["Bilal", "30"],
      ["Tariq", "invalid-number"],
    ];

    const mappings = [
      { key: "name", header: "Name", required: true },
      {
        key: "age",
        header: "Age",
        transform: (raw: string) => {
          const num = Number(raw);
          if (isNaN(num)) throw new Error("Must be numeric");
          return num;
        },
      },
    ];

    const result = mapCsvGridToObjects(grid, mappings);

    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ name: "Bilal", age: 30 });
    expect(result.rowErrors).toHaveLength(1);
    expect(result.rowErrors[0].row).toBe(3);
  });
});

describe("csvTemplateGenerator", () => {
  it("generates a clean CSV template with headers and sample values", () => {
    const csv = generateCsvTemplate([
      { header: "Full Name", sample: "John Doe" },
      { header: "Email", sample: "john@example.com" },
      { header: "Role", sample: "Student" },
    ]);

    expect(csv).toBe('"Full Name","Email","Role"\n"John Doe","john@example.com","Student"');
  });

  it("returns empty string if column array is empty", () => {
    expect(generateCsvTemplate([])).toBe("");
  });
});
