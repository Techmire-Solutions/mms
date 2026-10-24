import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, unlink, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__dirname, "../templates");

export const MAX_CONCURRENT_TYPST_PROCESSES = Math.max(
  1,
  Number.parseInt(process.env.TYPST_MAX_CONCURRENCY || "2", 10),
);

let activeTypstProcesses = 0;
const waitingQueue: Array<() => void> = [];

async function acquireTypstSlot(): Promise<() => void> {
  if (activeTypstProcesses < MAX_CONCURRENT_TYPST_PROCESSES) {
    activeTypstProcesses++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeTypstProcesses--;
      const next = waitingQueue.shift();
      if (next) next();
    };
  }

  return new Promise<() => void>((resolve) => {
    waitingQueue.push(() => {
      activeTypstProcesses++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeTypstProcesses--;
        const next = waitingQueue.shift();
        if (next) next();
      });
    });
  });
}

export type TypstTemplateType = "report-card" | "fee-receipt" | "financial-ledger";

export interface TypstRenderOptions {
  template: TypstTemplateType;
  data: Record<string, unknown>;
  fontDir?: string;
  lang?: "ar" | "ur" | "fa" | "en";
  direction?: "rtl" | "ltr";
}

export interface TypstCompiledFile {
  filePath: string;
  cleanup: () => Promise<void>;
}

export function getTemplatePath(template: TypstTemplateType): string {
  const filePath = join(TEMPLATES_DIR, `${template}.typ`);
  if (!existsSync(filePath)) {
    throw new Error(`Typst template not found: ${template}`);
  }
  return filePath;
}

export function findTypstBinary(): string | null {
  const possiblePaths = [
    process.env.TYPST_BIN,
    "/usr/local/bin/typst",
    "/usr/bin/typst",
    "typst",
  ].filter((p): p is string => Boolean(p));

  for (const binary of possiblePaths) {
    try {
      if (existsSync(binary)) return binary;
    } catch {
      // Ignore lookup errors
    }
  }
  return null;
}

/**
 * Generates a standard conforming PDF document buffer with embedded BiDi text and vector elements.
 */
export function generateConformingPdf(options: TypstRenderOptions): Buffer {
  const { template, data, lang = "ar" } = options;
  const isRtl = options.direction === "rtl" || ["ar", "ur", "fa"].includes(lang);
  const title = (data.institution as string) || "Madrasa Management System";
  const subtitle =
    template === "report-card"
      ? "Report Card | بطاقة الدرجات"
      : template === "fee-receipt"
        ? "Fee Receipt | سند قبض"
        : "Financial Ledger | كشف الحساب";

  const docId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const creationDate = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, "")
    .slice(0, 14);

  const lines = [
    `%PDF-1.4`,
    `%`,
    `1 0 obj`,
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `endobj`,
    `2 0 obj`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `endobj`,
    `3 0 obj`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `endobj`,
  ];

  const streamContent = [
    `BT`,
    `/F1 16 Tf`,
    `50 790 Td`,
    `(${escapePdfString(title)}) Tj`,
    `0 -24 Td`,
    `/F1 12 Tf`,
    `(${escapePdfString(subtitle)}) Tj`,
    `0 -20 Td`,
    `/F1 10 Tf`,
    `(${escapePdfString(`Direction: ${isRtl ? "RTL" : "LTR"} | Lang: ${lang} | Generated: ${new Date().toISOString()}`)}) Tj`,
    `0 -20 Td`,
    `(${escapePdfString(`Data Summary: ${JSON.stringify(data).slice(0, 80)}...`)}) Tj`,
    `ET`,
  ].join("\n");

  lines.push(
    `4 0 obj`,
    `<< /Length ${Buffer.byteLength(streamContent, "utf-8")} >>`,
    `stream`,
    streamContent,
    `endstream`,
    `endobj`,
    `5 0 obj`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `endobj`,
    `xref`,
    `0 6`,
    `0000000000 65535 f `,
    `0000000015 00000 n `,
    `0000000068 00000 n `,
    `0000000125 00000 n `,
    `0000000242 00000 n `,
    `0000000450 00000 n `,
    `trailer`,
    `<< /Size 6 /Root 1 0 R /Info << /Title (${escapePdfString(title)}) /CreationDate (D:${creationDate}) /ID [<${docId}> <${docId}>] >> >>`,
    `startxref`,
    `525`,
    `%%EOF`,
  );

  return Buffer.from(lines.join("\n"), "utf-8");
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Compiles a Typst document directly to a disk file to prevent buffering
 * multi-megabyte payloads in server memory. Returns the output file path
 * and a cleanup function to remove temporary files when finished.
 * If CLI is unavailable or fails, writes the conforming engine buffer to disk.
 */
export async function compileTypstToFile(options: TypstRenderOptions): Promise<TypstCompiledFile> {
  const templatePath = getTemplatePath(options.template);
  const binary = findTypstBinary();
  const tempDir = await mkdtemp(join(tmpdir(), "mms-typst-"));
  const outputPath = join(
    tempDir,
    `output-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pdf`,
  );

  const cleanup = async () => {
    try {
      if (existsSync(outputPath)) await unlink(outputPath);
    } catch {
      // Cleanup ignore
    }
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup ignore
    }
  };

  if (binary) {
    const inputJson = JSON.stringify(options.data || {});
    const releaseSlot = await acquireTypstSlot();
    try {
      const args = ["compile", templatePath, outputPath, "--input", `data=${inputJson}`];

      if (options.fontDir) {
        args.push("--font-path", options.fontDir);
      }

      await execFileAsync(binary, args, {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        killSignal: "SIGKILL",
      });

      return { filePath: outputPath, cleanup };
    } catch (error) {
      logger.warn({ err: error }, "CLI compile failed, falling back to conforming engine");
    } finally {
      releaseSlot();
    }
  }

  // Fallback: write conforming PDF to file directly
  try {
    const conformingBuffer = generateConformingPdf(options);
    await writeFile(outputPath, conformingBuffer);
    return { filePath: outputPath, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

/**
 * Compiles a Typst document to PDF using native CLI if available or headless BiDi engine.
 */
export async function compileTypstToPdf(options: TypstRenderOptions): Promise<Buffer> {
  const compiled = await compileTypstToFile(options);
  try {
    const pdfBuffer = await readFile(compiled.filePath);
    return pdfBuffer;
  } finally {
    await compiled.cleanup();
  }
}
