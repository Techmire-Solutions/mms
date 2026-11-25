import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cli = vi.hoisted(() => ({
  args: [] as string[][],
  dataJson: null as string | null,
}));

vi.mock("node:child_process", () => ({
  execFile: (
    _file: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, output?: { stdout: string; stderr: string }) => void,
  ) => {
    cli.args.push(args);
    const root = args[args.indexOf("--root") + 1];
    if (root) {
      try {
        cli.dataJson = readFileSync(join(root, "data.json"), "utf8");
      } catch {
        cli.dataJson = null;
      }
    }
    // Typst writes the compiled PDF to the output argument.
    writeFileSync(args[2]!, "%PDF-1.4\n% mocked typst output\n%%EOF\n");
    callback(null, { stdout: "", stderr: "" });
  },
}));

import {
  compileTypstToPdf,
  getFontsPath,
  getTemplatePath,
  resolveTypstLocale,
  TemplateRenderError,
  type TypstTemplateType,
} from "../worker/processors/typst-compiler.js";
import { SUPPORTED_FONTS } from "../worker/templates/fonts/index.js";
import { processPdfRenderJob } from "../worker/processors/pdf-rendering.js";

describe("Typst BiDi Headless Document Engine (Phase 6)", () => {
  beforeEach(() => {
    cli.args.length = 0;
    cli.dataJson = null;
    // A real file so findTypstBinary() resolves; the mocked execFile never runs it.
    process.env.TYPST_BIN = process.execPath;
  });

  it("loads supported font definitions for Nastaliq, Arabic, and Sans", () => {
    expect(SUPPORTED_FONTS.nastaliq.family).toBe("Noto Nastaliq Urdu");
    expect(SUPPORTED_FONTS.arabic.family).toBe("Readex Pro");
    expect(SUPPORTED_FONTS.sans.family).toBe("Geist");
    expect(SUPPORTED_FONTS.nastaliq.direction).toBe("rtl");
  });

  it("locates valid Typst template paths and the bundled font directory", () => {
    const templates: TypstTemplateType[] = [
      "report-card",
      "fee-receipt",
      "financial-ledger",
      "trial-balance",
    ];
    for (const t of templates) {
      const path = getTemplatePath(t);
      expect(path).toContain(`${t}.typ`);
    }
    expect(getFontsPath()).toContain("fonts");
  });

  it("resolves the document language from explicit options and from the payload script", () => {
    expect(resolveTypstLocale({}, { lang: "en", direction: "ltr" })).toEqual({
      lang: "en",
      direction: "ltr",
    });
    expect(resolveTypstLocale({ studentName: "محمد أحمد" })).toEqual({
      lang: "ar",
      direction: "rtl",
    });
    expect(resolveTypstLocale({ studentName: "Zayd" })).toEqual({ lang: "en", direction: "ltr" });
  });

  it("compiles with a private data file (no payload in argv) and bundled fonts", async () => {
    const pdfBuffer = await compileTypstToPdf({
      template: "report-card",
      lang: "ur",
      direction: "rtl",
      data: {
        institution: "جامعة دار العلوم",
        studentName: "محمد أحمد خان",
        rollNumber: "R-1049",
        className: "حفظ القرآن الكريم",
        subjects: [{ name: "تجويد القرآن", maxMarks: 100, obtainedMarks: 98, grade: "ممتاز" }],
        totalMarks: 200,
        obtainedMarks: 192,
        percentage: "96%",
        grade: "ممتاز مرتفع",
      },
    });

    expect(pdfBuffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    const args = cli.args[0] ?? [];
    expect(args).toContain("--root");
    expect(args).toContain("--font-path");
    // The student payload must never be visible in `ps`.
    expect(args.join(" ")).not.toContain("محمد");
    expect(args.some((arg) => arg.startsWith("--input"))).toBe(false);
    expect(JSON.parse(cli.dataJson ?? "{}")).toMatchObject({
      lang: "ur",
      direction: "rtl",
      studentName: "محمد أحمد خان",
    });
  });

  it("fails loudly when the Typst CLI is unavailable (never a placeholder PDF)", async () => {
    process.env.TYPST_BIN = "/nonexistent/typst";
    await expect(
      compileTypstToPdf({ template: "report-card", data: { studentName: "Zayd" } }),
    ).rejects.toBeInstanceOf(TemplateRenderError);
  });

  it("renders each template to a real PDF file through the mocked CLI", async () => {
    for (const template of ["fee-receipt", "financial-ledger"] as TypstTemplateType[]) {
      const pdfBuffer = await compileTypstToPdf({
        template,
        data: { institution: "Madrasa", entries: [] },
      });
      expect(pdfBuffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    }
  });

  it("processes a PDF render job and returns stored upload metadata", async () => {
    const progressEvents: number[] = [];
    const result = await processPdfRenderJob(
      "demo-tenant",
      {
        template: "report-card",
        data: { institution: "Demo Madrasa", studentName: "Zayd" },
        filename: "zayd-report.pdf",
        lang: "en",
      },
      (pct) => {
        progressEvents.push(pct);
      },
    );

    expect(result.key).toContain("tenants/demo-tenant/exports/");
    expect(result.key).toContain("zayd-report.pdf");
    expect(progressEvents).toContain(100);
  });
});
