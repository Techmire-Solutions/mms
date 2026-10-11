import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVAILABLE_STUDENT_CARD_FIELDS,
  loadStudentCardTemplate,
  resetStudentCardTemplate,
  saveStudentCardTemplate,
} from "./studentCardTemplateStore";
import { getDefaultStudentCardTemplate } from "./studentCardTemplateDefaults";
import { getAvailableStudentCardPresets } from "./studentCardTemplatePresets";

describe("studentCardTemplateStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it("loads the default template when storage is empty", () => {
    const template = loadStudentCardTemplate();
    expect(template).toBeDefined();
    expect(template.pageSize).toBe("CR80");
    expect(template.orientation).toBe("landscape");
    expect(template.elements.length).toBeGreaterThan(0);
  });

  it("saves and loads a modified template", () => {
    const defaultTmpl = getDefaultStudentCardTemplate();
    const modified = {
      ...defaultTmpl,
      elements: [
        ...defaultTmpl.elements,
        {
          id: "custom_text",
          type: "text",
          label: "Custom School Notice",
          x: 10,
          y: 10,
          w: 100,
          h: 20,
        },
      ],
    };

    saveStudentCardTemplate(modified);
    const loaded = loadStudentCardTemplate();
    expect(loaded.elements.some((el) => el.id === "custom_text")).toBe(true);
  });

  it("throws TypeError when saving an invalid template without pageSize", () => {
    expect(() => {
      // @ts-expect-error - testing invalid template input
      saveStudentCardTemplate({ elements: [] });
    }).toThrow(TypeError);
  });

  it("resets template back to default", () => {
    const defaultTmpl = getDefaultStudentCardTemplate();
    saveStudentCardTemplate({
      ...defaultTmpl,
      elements: [],
    });

    const reset = resetStudentCardTemplate();
    expect(reset.elements.length).toBeGreaterThan(0);
    const loaded = loadStudentCardTemplate();
    expect(loaded.elements.length).toBe(reset.elements.length);
  });

  it("provides available presets with standard, badge, and minimal designs", () => {
    const presets = getAvailableStudentCardPresets();
    expect(presets.length).toBe(3);
    expect(presets.map((p) => p.key)).toEqual(["standard", "badge", "minimal"]);
  });

  it("preserves dual-sided backElements when saving and loading", () => {
    const defaultTmpl = getDefaultStudentCardTemplate();
    expect(defaultTmpl.backElements).toBeDefined();
    expect(defaultTmpl.backElements?.length).toBeGreaterThan(0);

    const modified = {
      ...defaultTmpl,
      backElements: [
        ...(defaultTmpl.backElements || []),
        {
          id: "custom_back_note",
          type: "text",
          label: "Special Notice",
          x: 10,
          y: 10,
          w: 120,
          h: 20,
        },
      ],
    };

    saveStudentCardTemplate(modified);
    const loaded = loadStudentCardTemplate();
    expect(loaded.backElements?.some((el) => el.id === "custom_back_note")).toBe(true);
  });

  it("defines available fields with category metadata including photo, card_terms, and expiry", () => {
    expect(AVAILABLE_STUDENT_CARD_FIELDS.length).toBeGreaterThan(15);
    const fields = AVAILABLE_STUDENT_CARD_FIELDS.map((f) => f.field);
    expect(fields).toContain("photo");
    expect(fields).toContain("student_name");
    expect(fields).toContain("gr_number");
    expect(fields).toContain("session_name");
    expect(fields).toContain("emergency_phone");
    expect(fields).toContain("blood_group");
    expect(fields).toContain("national_id");
    expect(fields).toContain("card_terms");
    expect(fields).toContain("authorized_signature");
    expect(fields).toContain("expiry_date");
  });
});
