import { describe, expect, it, vi } from "vitest";
import {
  alignElements,
  boxesIntersect,
  bringSelectedToFront,
  CANVAS_ACCENT,
  centerElementOnPage,
  computeSmartGuides,
  distributeElements,
  downloadTemplateJson,
  interpolateTemplateTokens,
  newId,
  normalizeHexColor,
  readTemplateJsonFile,
  sendSelectedToBack,
  snap,
} from "./templateEditorUtils";
import type { DocumentTemplate } from "@mms/shared";

describe("templateEditorUtils", () => {
  describe("CANVAS_ACCENT", () => {
    it("derives selection colors from the primary brand token", () => {
      expect(CANVAS_ACCENT.selection).toBe("hsl(var(--primary, 199 89% 48%))");
      expect(CANVAS_ACCENT.selectionSoft).toBe("hsl(var(--primary, 199 89% 48%) / 0.06)");
      expect(CANVAS_ACCENT.marqueeSoft).toBe("hsl(var(--primary, 199 89% 48%) / 0.08)");
    });

    it("derives the strong selection variant and grid from semantic tokens", () => {
      expect(CANVAS_ACCENT.selectionStrong).toContain("var(--primary, 201 96% 27%)");
      expect(CANVAS_ACCENT.grid).toBe("hsl(var(--muted-foreground, 215 20% 65%) / 0.6)");
    });

    it("contains no bare hex colors outside var() fallbacks", () => {
      for (const value of Object.values(CANVAS_ACCENT)) {
        const withoutFallbacks = value.replace(/var\([^)]*\)/g, "");
        expect(withoutFallbacks).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      }
    });
  });

  describe("snap", () => {
    it("snaps values to nearest multiple of 4", () => {
      expect(snap(0)).toBe(0);
      expect(snap(2)).toBe(4);
      expect(snap(5)).toBe(4);
      expect(snap(6)).toBe(8);
      expect(snap(15)).toBe(16);
    });
  });

  describe("newId", () => {
    it("generates unique element IDs with el_ prefix and UUID suffix", () => {
      const id1 = newId();
      const id2 = newId();
      // crypto.randomUUID() format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(id1).toMatch(/^el_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(id2).toMatch(/^el_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(id1).not.toBe(id2);
    });
  });

  describe("boxesIntersect", () => {
    it("returns true when two bounding boxes overlap", () => {
      const boxA = { x: 10, y: 10, w: 50, h: 50 };
      const boxB = { x: 30, y: 30, w: 50, h: 50 };
      expect(boxesIntersect(boxA, boxB)).toBe(true);
    });

    it("returns false when two bounding boxes do not overlap", () => {
      const boxA = { x: 10, y: 10, w: 20, h: 20 };
      const boxB = { x: 100, y: 100, w: 20, h: 20 };
      expect(boxesIntersect(boxA, boxB)).toBe(false);
    });
  });

  describe("alignElements", () => {
    const initialElements = [
      { id: "el_1", x: 20, y: 10, w: 100, h: 30 },
      { id: "el_2", x: 80, y: 60, w: 120, h: 40 },
      { id: "el_3", x: 200, y: 200, w: 50, h: 20 },
    ];

    it("aligns selected elements to the left edge", () => {
      const aligned = alignElements(initialElements, ["el_1", "el_2"], "left");
      expect(aligned[0]!.x).toBe(20);
      expect(aligned[1]!.x).toBe(20);
      expect(aligned[2]!.x).toBe(200); // unaffected
    });

    it("aligns selected elements to the top edge", () => {
      const aligned = alignElements(initialElements, ["el_1", "el_2"], "top");
      expect(aligned[0]!.y).toBe(12); // snapped nearest multiple of 4
      expect(aligned[1]!.y).toBe(12);
    });

    it("aligns selected elements horizontally centered", () => {
      const aligned = alignElements(initialElements, ["el_1", "el_2"], "centerH");
      expect(aligned[0]!.x).toBe(60);
      expect(aligned[1]!.x).toBe(52);
    });

    it("aligns selected elements to the right and bottom edges", () => {
      const alignedRight = alignElements(initialElements, ["el_1", "el_2"], "right");
      expect(alignedRight[0]!.x).toBe(100);
      expect(alignedRight[1]!.x).toBe(80);

      const alignedBottom = alignElements(initialElements, ["el_1", "el_2"], "bottom");
      expect(alignedBottom[0]!.y).toBe(72);
      expect(alignedBottom[1]!.y).toBe(60);
    });

    it("aligns selected elements vertically centered", () => {
      const aligned = alignElements(initialElements, ["el_1", "el_2"], "centerV");
      expect(aligned[0]!.y).toBe(40);
      expect(aligned[1]!.y).toBe(36);
    });

    it("returns unchanged array if less than 2 elements are selected", () => {
      const aligned = alignElements(initialElements, ["el_1"], "left");
      expect(aligned).toEqual(initialElements);
    });
  });

  describe("centerElementOnPage", () => {
    it("centers an element on both axes or specified axis", () => {
      const el = { id: "el_1", x: 10, y: 10, w: 100, h: 40 };
      const centeredBoth = centerElementOnPage(el, 400, 600, "both");
      expect(centeredBoth.x).toBe(152); // (400 - 100) / 2 = 150 -> snapped to 152
      expect(centeredBoth.y).toBe(280); // (600 - 40) / 2 = 280 -> snapped to 280

      const centeredH = centerElementOnPage(el, 400, 600, "h");
      expect(centeredH.x).toBe(152);
      expect(centeredH.y).toBe(10);

      const centeredV = centerElementOnPage(el, 400, 600, "v");
      expect(centeredV.x).toBe(10);
      expect(centeredV.y).toBe(280);
    });
  });

  describe("distributeElements", () => {
    it("distributes elements evenly along horizontal and vertical axes", () => {
      const elements = [
        { id: "e1", x: 0, y: 0, w: 20, h: 20 },
        { id: "e2", x: 10, y: 15, w: 20, h: 20 },
        { id: "e3", x: 100, y: 100, w: 20, h: 20 },
      ];

      const distributedH = distributeElements(elements, ["e1", "e2", "e3"], "horizontal");
      expect(distributedH[0]!.x).toBe(0);
      expect(distributedH[1]!.x).toBe(52); // evenly spaced between 0 and 100
      expect(distributedH[2]!.x).toBe(100);

      const distributedV = distributeElements(elements, ["e1", "e2", "e3"], "vertical");
      expect(distributedV[0]!.y).toBe(0);
      expect(distributedV[1]!.y).toBe(52);
      expect(distributedV[2]!.y).toBe(100);
    });

    it("returns unchanged elements if fewer than 3 elements are selected", () => {
      const elements = [
        { id: "e1", x: 0, y: 0, w: 20, h: 20 },
        { id: "e2", x: 10, y: 15, w: 20, h: 20 },
      ];
      expect(distributeElements(elements, ["e1", "e2"], "horizontal")).toEqual(elements);
    });
  });

  describe("bringSelectedToFront and sendSelectedToBack", () => {
    const items = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ];

    it("moves selected items to front while maintaining relative order", () => {
      const result = bringSelectedToFront(items, ["a", "c"]);
      expect(result.map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
    });

    it("moves selected items to back while maintaining relative order", () => {
      const result = sendSelectedToBack(items, ["b", "d"]);
      expect(result.map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
    });

    it("returns original items if selectedIds is empty", () => {
      expect(bringSelectedToFront(items, [])).toEqual(items);
      expect(sendSelectedToBack(items, [])).toEqual(items);
    });
  });

  describe("normalizeHexColor", () => {
    it("converts 3-digit hex to 6-digit lowercase hex", () => {
      expect(normalizeHexColor("#fff")).toBe("#ffffff");
      expect(normalizeHexColor("#0f0")).toBe("#00ff00");
    });

    it("keeps valid 6-digit hex and normalizes casing", () => {
      expect(normalizeHexColor("#10B981")).toBe("#10b981");
    });

    it("converts rgb and rgba strings to 6-digit hex", () => {
      expect(normalizeHexColor("rgb(16, 185, 129)")).toBe("#10b981");
      expect(normalizeHexColor("rgba(255, 255, 255, 0.8)")).toBe("#ffffff");
      expect(normalizeHexColor("rgb(0, 0, 0)")).toBe("#000000");
    });

    it("handles common named colors", () => {
      expect(normalizeHexColor("white")).toBe("#ffffff");
      expect(normalizeHexColor("black")).toBe("#000000");
    });

    it("falls back to default for invalid colors", () => {
      expect(normalizeHexColor("invalid-color", "#0f172a")).toBe("#0f172a");
      expect(normalizeHexColor(undefined, "#123456")).toBe("#123456");
    });
  });

  describe("downloadTemplateJson", () => {
    it("creates an anchor download trigger with a blob URL and revokes it after delay", () => {
      vi.useFakeTimers();
      const template: DocumentTemplate = {
        pageSize: "A5",
        orientation: "portrait",
        elements: [],
      };

      const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      let downloadName = "";
      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockReturnValue({
        set href(_val: string) {},
        set download(val: string) {
          downloadName = val;
        },
        click: clickSpy,
      } as unknown as HTMLElement);

      downloadTemplateJson(template, "invoice");

      expect(downloadName).toBe("invoice-template-a5.json");
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
      vi.useRealTimers();
    });
  });

  describe("readTemplateJsonFile", () => {
    it("rejects files exceeding 5MB limit", () => {
      const hugeFile = { size: 6 * 1024 * 1024, name: "huge.json" } as File;
      const onSuccess = vi.fn();
      const onError = vi.fn();
      readTemplateJsonFile(hugeFile, onSuccess, onError);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("parses valid template JSON and triggers onSuccess", () => {
      const template: DocumentTemplate = {
        pageSize: "A4",
        orientation: "landscape",
        elements: [{ id: "el_1", type: "static", label: "Test", x: 10, y: 10, w: 100, h: 20 }],
      };

      const mockFile = new File([JSON.stringify(template)], "template.json", {
        type: "application/json",
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      readTemplateJsonFile(mockFile, onSuccess, onError);

      // simulate reader load
      const readerInstance = (globalThis as unknown as { FileReader: unknown }).FileReader;
      expect(readerInstance).toBeDefined();
    });
  });

  describe("interpolateTemplateTokens", () => {
    it("interpolates mustache tokens with corresponding data keys", () => {
      const result = interpolateTemplateTokens("Hello {{studentName}}, ID: {{studentId}}", {
        studentName: "Fatima Zahra",
        studentId: 1042,
      });
      expect(result).toBe("Hello Fatima Zahra, ID: 1042");
    });

    it("resolves nested dotted paths in structured data", () => {
      const result = interpolateTemplateTokens(
        "Student: {{ student.profile.fullName }}, Due: {{ invoice.total }}",
        {
          student: { profile: { fullName: "Ali Khan" } },
          invoice: { total: 0 },
        },
      );
      expect(result).toBe("Student: Ali Khan, Due: 0");
    });

    it("leaves unresolved tokens intact when key is missing in data", () => {
      const result = interpolateTemplateTokens("Fee: {{feeAmount}}, Due: {{dueDate}}", {
        feeAmount: "500.00",
      });
      expect(result).toBe("Fee: 500.00, Due: {{dueDate}}");
    });

    it("returns raw text when data is missing or empty string", () => {
      expect(interpolateTemplateTokens("")).toBe("");
      expect(interpolateTemplateTokens("No tokens here")).toBe("No tokens here");
      expect(interpolateTemplateTokens("{{token}}", undefined)).toBe("{{token}}");
    });
  });

  describe("computeSmartGuides", () => {
    const pageWidth = 400;
    const pageHeight = 600;

    it("snaps active box left edge to neighboring box left edge within threshold", () => {
      const activeBox = { x: 52, y: 100, w: 50, h: 30 }; // within 5px of 50
      const otherBoxes = [{ x: 50, y: 200, w: 100, h: 40 }];

      const result = computeSmartGuides(activeBox, otherBoxes, pageWidth, pageHeight, 5);

      expect(result.x).toBe(52); // 50 snapped to nearest 4 = 52
      expect(result.guides).toContainEqual({ orientation: "vertical", position: 50 });
    });

    it("snaps active box to center of page horizontally", () => {
      // Page width 400, center is 200. Box w=60, center is x + 30.
      // If x = 171, center is 201 (within 5px of 200).
      const activeBox = { x: 171, y: 100, w: 60, h: 30 };
      const otherBoxes: { x: number; y: number; w: number; h: number }[] = [];

      const result = computeSmartGuides(activeBox, otherBoxes, pageWidth, pageHeight, 5);

      // Snapped x = 200 - 30 = 170 -> snapped nearest 4 = 172
      expect(result.x).toBe(172);
      expect(result.guides).toContainEqual({ orientation: "vertical", position: 200 });
    });

    it("does not snap when distance exceeds threshold", () => {
      const activeBox = { x: 88, y: 100, w: 50, h: 30 };
      const otherBoxes = [{ x: 50, y: 200, w: 100, h: 40 }];

      const result = computeSmartGuides(activeBox, otherBoxes, pageWidth, pageHeight, 5);

      expect(result.x).toBe(88);
      expect(result.guides.filter((g) => g.orientation === "vertical")).toHaveLength(0);
    });
  });
});
