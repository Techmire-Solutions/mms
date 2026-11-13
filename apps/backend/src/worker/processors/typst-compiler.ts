import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, copyFile, unlink, mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isRtlText } from "@mms/shared";
import { logger } from "../../lib/logger.js";

const execFileAsync = promisify(execFile);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__dirname, "../templates");

export const MAX_CONCURRENT_TYPST_PROCESSES = Math.max(
  1,
  Number.parseInt(process.env.TYPST_MAX_CONCURRENCY || "2", 10),
);

/**
 * Thrown when a document cannot be rendered by the Typst engine.
 *
 * There is deliberately **no placeholder PDF fallback**: a synthetic "conforming" buffer used to
 * be written when the CLI was missing or failed, which published a junk PDF containing a slice of
 * the payload and reported success. A failed render must fail the job so the caller sees it.
 */
export class TemplateRenderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TemplateRenderError";
  }
}

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

export type TypstTemplateType =
  "report-card" | "fee-receipt" | "financial-ledger" | "trial-balance";

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

const RTL_LANGS = new Set(["ar", "ur", "fa"]);

/**
 * Resolves the script language/direction for a document.
 *
 * The templates used to hardcode Arabic/RTL, so an English tenant's card printed right-to-left.
 * An explicit option wins; otherwise the payload's own script decides, and Latin text defaults to
 * `en`/`ltr`.
 */
export function resolveTypstLocale(
  data: Record<string, unknown>,
  options: Pick<TypstRenderOptions, "lang" | "direction"> = {},
): { lang: "ar" | "ur" | "fa" | "en"; direction: "rtl" | "ltr" } {
  const lang = options.lang ?? (isRtlText(JSON.stringify(data ?? {})) ? "ar" : "en");
  const direction = options.direction ?? (RTL_LANGS.has(lang) ? "rtl" : "ltr");
  return { lang, direction };
}

export function getTemplatePath(template: TypstTemplateType): string {
  const filePath = join(TEMPLATES_DIR, `${template}.typ`);
  if (!existsSync(filePath)) {
    throw new TemplateRenderError(`Typst template not found: ${template}`);
  }
  return filePath;
}

/** Bundled fonts directory (assets are mounted in deployments; env can override). */
export function getFontsPath(): string {
  return process.env.TYPST_FONT_DIR || join(TEMPLATES_DIR, "fonts", "assets");
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
 * Compiles a Typst document directly to a disk file (never buffering the PDF in memory).
 *
 * The payload is written to `data.json` inside a private temp root instead of being passed as
 * `--input data=...`: student marks/names must not appear in the process argv (`ps`) and a large
 * payload must not hit the OS argument limit. The template is copied into the same root so
 * `json("/data.json")` resolves.
 */
export async function compileTypstToFile(options: TypstRenderOptions): Promise<TypstCompiledFile> {
  const templatePath = getTemplatePath(options.template);
  const binary = findTypstBinary();
  if (!binary) {
    throw new TemplateRenderError(
      `Typst CLI is not available; cannot render ${options.template}. Install typst and set TYPST_BIN (or add it to PATH).`,
    );
  }

  const tempDir = await mkdtemp(join(tmpdir(), "mms-typst-"));
  const outputPath = join(
    tempDir,
    `output-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pdf`,
  );
  const templateCopy = join(tempDir, basename(templatePath));
  const dataPath = join(tempDir, "data.json");

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

  const releaseSlot = await acquireTypstSlot();
  try {
    await copyFile(templatePath, templateCopy);
    const locale = resolveTypstLocale(options.data, options);
    await writeFile(
      dataPath,
      JSON.stringify({ ...options.data, lang: locale.lang, direction: locale.direction }),
      "utf8",
    );

    const args = ["compile", templateCopy, outputPath, "--root", tempDir];
    const fontDir = options.fontDir ?? getFontsPath();
    if (existsSync(fontDir)) {
      args.push("--font-path", fontDir);
    }

    await execFileAsync(binary, args, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGKILL",
    });

    if (!existsSync(outputPath)) {
      throw new TemplateRenderError(`Typst produced no output for ${options.template}`);
    }

    return { filePath: outputPath, cleanup };
  } catch (error) {
    await cleanup();
    if (error instanceof TemplateRenderError) throw error;
    logger.error({ err: error, template: options.template }, "Typst compilation failed");
    throw new TemplateRenderError(`Typst compilation failed for ${options.template}`, {
      cause: error,
    });
  } finally {
    releaseSlot();
  }
}

/**
 * Compiles a Typst document to a PDF buffer. Only for callers that genuinely need the bytes;
 * the PDF runners stream the compiled file instead.
 */
export async function compileTypstToPdf(options: TypstRenderOptions): Promise<Buffer> {
  const compiled = await compileTypstToFile(options);
  try {
    return await readFile(compiled.filePath);
  } finally {
    await compiled.cleanup();
  }
}
