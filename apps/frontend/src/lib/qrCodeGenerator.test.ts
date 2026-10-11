import { describe, expect, it } from "vitest";
import { generateQrMatrix, generateQrSvgUri } from "./qrCodeGenerator.js";

describe("qrCodeGenerator", () => {
  describe("generateQrMatrix", () => {
    it("generates a 25x25 boolean matrix", () => {
      const matrix = generateQrMatrix("https://mms.app/verify/RCP-1001");
      expect(matrix).toHaveLength(25);
      expect(matrix.every((row) => row.length === 25)).toBe(true);
      expect(matrix.every((row) => row.every((cell) => typeof cell === "boolean"))).toBe(true);
    });

    it("places finder patterns in three corners", () => {
      const matrix = generateQrMatrix("TEST");

      // Top-left finder center (row 3, col 3) should be true (black center)
      expect(matrix[3][3]).toBe(true);
      // Top-right finder center (row 3, col 21)
      expect(matrix[3][21]).toBe(true);
      // Bottom-left finder center (row 21, col 3)
      expect(matrix[21][3]).toBe(true);

      // Top-left outer border (0,0) to (0,6) should be true
      for (let c = 0; c <= 6; c++) {
        expect(matrix[0][c]).toBe(true);
        expect(matrix[6][c]).toBe(true);
      }
      for (let r = 0; r <= 6; r++) {
        expect(matrix[r][0]).toBe(true);
        expect(matrix[r][6]).toBe(true);
      }
    });

    it("generates deterministic output for the same input", () => {
      const matrix1 = generateQrMatrix("MMS-RCP-12345");
      const matrix2 = generateQrMatrix("MMS-RCP-12345");
      expect(matrix1).toEqual(matrix2);
    });

    it("generates different matrices for different inputs", () => {
      const matrixA = generateQrMatrix("MMS-RCP-1");
      const matrixB = generateQrMatrix("MMS-RCP-2");
      expect(matrixA).not.toEqual(matrixB);
    });
  });

  describe("generateQrSvgUri", () => {
    it("returns a data:image/svg+xml SVG URI", () => {
      const uri = generateQrSvgUri("https://example.com/receipts/123");
      expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
      const decodedSvg = decodeURIComponent(uri.replace("data:image/svg+xml;utf8,", ""));
      expect(decodedSvg).toContain("<svg");
      expect(decodedSvg).toContain('viewBox="0 0 29 29"');
      expect(decodedSvg).toContain("<rect");
      expect(decodedSvg).toContain("</svg>");
    });

    it("respects custom fill colors", () => {
      const uri = generateQrSvgUri("TEST", "#4f46e5");
      const decodedSvg = decodeURIComponent(uri.replace("data:image/svg+xml;utf8,", ""));
      expect(decodedSvg).toContain('fill="#4f46e5"');
    });

    it("handles empty string gracefully with fallback", () => {
      const uri = generateQrSvgUri("");
      expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
      const decodedSvg = decodeURIComponent(uri.replace("data:image/svg+xml;utf8,", ""));
      expect(decodedSvg).toContain("<svg");
    });
  });
});
