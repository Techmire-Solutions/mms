import { describe, expect, it, vi } from "vitest";
import {
  MAX_TABLE_COLUMNS,
  MAX_TEMPLATE_ELEMENTS,
  MAX_TEMPLATE_FILE_BYTES,
  parseTemplateJson,
  readTemplateJsonFile,
  type TemplateImportError,
} from "./templateJsonIo";

const validTemplate = {
  pageSize: "A6",
  orientation: "portrait",
  elements: [
    { id: "el-1", type: "static", label: "Title", x: 0, y: 0, w: 100, h: 20 },
    { id: "el-2", type: "static", label: "Second", x: 0, y: 30, w: 100, h: 20 },
  ],
};

describe("templateJsonIo", () => {
  it("parses a valid template", () => {
    const parsed = parseTemplateJson(JSON.stringify(validTemplate));
    expect(parsed.pageSize).toBe("A6");
    expect(parsed.elements).toHaveLength(2);
  });

  it("regenerates duplicate and blank element ids", () => {
    const parsed = parseTemplateJson(
      JSON.stringify({
        ...validTemplate,
        elements: [
          { ...validTemplate.elements[0], id: "same" },
          { ...validTemplate.elements[1], id: "same" },
          { ...validTemplate.elements[1], id: "" },
        ],
      }),
    );

    const ids = parsed.elements.map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("same");
    expect(ids[1]).not.toBe("same");
  });

  it("rejects unknown keys instead of carrying them into the next save", () => {
    expect(() =>
      parseTemplateJson(
        JSON.stringify({
          ...validTemplate,
          elements: [{ ...validTemplate.elements[0], unexpected: true }],
        }),
      ),
    ).toThrow(/Unrecognized key|unrecognized/i);
  });

  it("rejects a template above the element ceiling", () => {
    const elements = Array.from({ length: MAX_TEMPLATE_ELEMENTS + 1 }, (_, index) => ({
      ...validTemplate.elements[0],
      id: `el-${index}`,
    }));

    expect(() => parseTemplateJson(JSON.stringify({ ...validTemplate, elements }))).toThrow(
      new RegExp(String(MAX_TEMPLATE_ELEMENTS)),
    );
  });

  it("truncates table columns above the ceiling", () => {
    const columns = Array.from({ length: MAX_TABLE_COLUMNS + 10 }, (_, index) => ({
      header: `H${index}`,
      field: `f${index}`,
    }));
    const parsed = parseTemplateJson(
      JSON.stringify({
        ...validTemplate,
        elements: [{ ...validTemplate.elements[0], type: "table", columns }],
      }),
    );

    expect(parsed.elements[0]?.columns).toHaveLength(MAX_TABLE_COLUMNS);
  });

  it("rejects a JSON file above the 1 MB request limit", () => {
    const onError = vi.fn();
    const file = new File(["x"], "template.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: MAX_TEMPLATE_FILE_BYTES + 1 });

    readTemplateJsonFile(file, vi.fn(), onError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as TemplateImportError).code).toBe("too-large");
  });

  it("reads and validates a real file", async () => {
    const file = new File([JSON.stringify(validTemplate)], "template.json", {
      type: "application/json",
    });

    const parsed = await new Promise<unknown>((resolve, reject) => {
      readTemplateJsonFile(file, resolve, reject);
    });

    expect(parsed).toMatchObject({ pageSize: "A6" });
  });
});
