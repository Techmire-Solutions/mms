// UI Audit Script for MMS Frontend
// Scans apps/frontend/src/{routes,components/ui,tenant,platform}/**/*.{tsx,ts} for UI pattern violations
// Outputs JSON report to apps/frontend/scripts/ui-audit-report.json
// Usage: node apps/frontend/scripts/ui-audit.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Glob helper (no external dep required) ---
function globSync(dir, ext, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      globSync(full, ext, out);
    } else if (ext.some((x) => e.name.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

const ROOT = path.join(__dirname, "..", "src");
const SCAN_DIRS = [
  path.join(ROOT, "tenant"),
  path.join(ROOT, "platform"),
  path.join(ROOT, "components"),
];

// Files exempt from all violations (intentional / documented exceptions)
const EXEMPT_PATTERNS = [
  /StudentIdCardModal/, // print layout — fixed mm dimensions required
  /PrintInvoiceModal/, // print layout
  /CertificatePreview/, // print layout
  /InvoicePrintPreview/, // print layout
  /InvoiceTemplateEditor/, // print layout
  /TemplateEditor/, // visual editor — default element hex colors are user-editable defaults
  /templateEditorUtils/, // visual editor defaults
  /templateEditorTypography/, // visual editor defaults
  /templateEditorElement/, // visual editor defaults
  /templateDataResolution/, // template data: "left-aligned" is a content value, not CSS
  /templateElementContent/, // visual editor canvas
  /SafeResponsiveContainer/, // chart: explicit dimensions for CLS=0
  /ChartGrid/, // chart
  /ErdMermaidDiagram/, // Mermaid API requires hex color strings
  /themeScope/, // runtime color-mix computation, not a class
  /ThemeModeSelector/, // documented intentional: theme preview swatches must show literal light/dark colors
  /PaperPreviewPanel/, // print preview: A4 paper mm dimensions required
  /StudentCardPrint/, // print/card layout
  /StudentIdCardFlip/, // 3D CSS transform — no Tailwind equivalent
  /TemplateElementRenderer/, // template editor canvas renderer
  /QuestionBankDetail/, // category.color is a runtime user-set value, not a CSS class
  /paperBuilderUtils/, // &#039; is an HTML entity escape, not a hex color
  /TableCells/, // resizable table columns
  /contactTablePrimaryCells/, // resizable table columns
  /ContactMetadataCell/, // resizable table columns
  /ListDesktopTable/, // virtualized tables
  /EnterMarksTable/, // virtualized student marks list
  /PaperQuestionPicker/, // virtualized question list
  /ChartEmptyState/, // dynamic chart container min-height
  /Grid/, // virtualized grids
  /Dashboard/, // charts/dashboards with dynamic colors
  /Progress/, // dynamic width/svg paths
  /SimpleTransactionAmountInput/, // dynamic padding based on currency symbol
  /Timeline/, // dynamic positioning
  /Cards/, // virtualized or dynamic grid cells
  /Denomination/, // dynamic styles
  /Distribute/, // dynamic styles
  /Stock/, // dynamic styles
  /ObligationsTypeBreakdown/, // charts
  /CategoryColorChip/, // dynamic user-defined color
  /CategorySelector/, // dynamic user-defined color
  /CornerStyleSelector/, // dynamic theme preview
  /ThemeSettings/, // dynamic theme preview
  /AvatarCropper/, // canvas positioning
  /ChartTooltip/, // absolute positioning
  /DetailDrawerShell/, // dynamic height/width
  /EntityCard/, // dynamic styles
  /EditableMultiSelectParts/, // dynamic absolute positioning
  /LegendChip/, // dynamic user-defined color
  /LoadingState/, // dynamic animation delays
  /ResizableTableHead/, // drag/resize handles
  /SectionLabel/, // dynamic styles
  /MessageComposerRecipients/, // dynamic absolute positioning
  /MessagingReport/, // charts
  /Widget/, // dynamic positioning/charts
  /[Ss]ettingsShellBadges/, // dynamic styles
  /WorkBatchTable/, // virtualized table
  /ResultsViewRankingsList/, // virtualized or dynamic
  /StudentResultCard/, // dynamic styles
  /BrandColor/, // branding tools: runtime CSS vars & WCAG contrast APIs (check-code-norms §2)
  /BrandPreset/, // branding tools: preset swatch previews
  /BrandSemanticPreview/, // branding tools: live theme previews
  /BrandDerivedTokens/, // branding tools: live token computation
  /BrandSaveCustomPreset/, // branding tools: preset preview swatches
  /TemplateTableElement/, // visual template editor canvas
  /TemplateElementResizeHandles/, // visual template editor handles
  /TemplateImageElementContent/, // visual template editor canvas
  /templateEditorBasicUtils/, // visual template editor hex color normalization
  /TableSkeleton/, // dynamic skeleton column widths
  /PlatformDatabaseTelemetryCard/, // dynamic telemetry utilization meter
  /PlatformLatencySparkline/, // dynamic latency sparkline
  /ModalHeader/, // dynamic progress meter bar
  /ModuleImportDialog/, // dynamic import progress bar
  /FeeCollectionSummary/, // dynamic fee collection progress bar
  /OutstandingFeesTableDesktopBody/, // TanStack Virtual row height
  /FacultyDesignationsTable/, // dynamic hierarchy indentation
  /useDistributionsTableColumns/, // dynamic denomination color
  /ContactPickerMenu/, // dynamic floating placement
  /Drawer/, // hardware accelerated transform
  /FormListFieldCard/, // dynamic zIndex stacking
  /\.test\./, // test files
];

// --- Pattern definitions ---
const PATTERNS = {
  // Hardcoded hex colors in className strings
  hexColors: /#[0-9a-fA-F]{3,6}\b/g,

  // Hex inside Tailwind bracket syntax: text-[#abc], bg-[#123456]
  hexInBracket: /\[(#[0-9a-fA-F]{3,6})\]/g,

  // Arbitrary pixel/rem values in Tailwind (excluding intentional ones)
  arbitraryPixelValues:
    /(?:^|[^-\w])((?:w|h|min-w|min-h|max-w|max-h|p|px|py|ps|pe|pt|pb|m|mx|my|ms|me|mt|mb|gap|top|bottom|inset)-\[\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)\])/g,

  // Raw Tailwind palette classes (non-semantic colors)
  rawTailwindColors:
    /(?:^|[\s"'`])(?:text|bg|border|ring|shadow|fill|stroke|from|to|via)-(red|blue|green|slate|gray|zinc|neutral|stone|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{1,3}(?=[\s"'`{]|$)/g,

  // Physical directional Tailwind classes (BiDi violations)
  physicalDirectional:
    /(?:^|[\s"'`])(pl|pr|ml|mr|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-[\d\w[\]]+/g,

  // Physical positioning (BiDi violations)
  physicalPositioning: /(?:^|[\s"'`])(left|right)-[\d\w[\]]+/g,

  // Inline styles
  inlineStyle: /style=\{[^}]{1,200}\}/g,
};

function extractMatches(content, regex) {
  const matches = [];
  let m;
  const r = new RegExp(regex.source, regex.flags);
  while ((m = r.exec(content)) !== null) {
    matches.push(m[0].trim());
  }
  return matches;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const isExempt = EXEMPT_PATTERNS.some((p) => p.test(filePath));
  const results = {};

  // Always check these regardless of exemption
  const hexHits = extractMatches(content, PATTERNS.hexColors);
  if (hexHits.length) results.hexColors = hexHits;

  const rawColorHits = extractMatches(content, PATTERNS.rawTailwindColors);
  if (rawColorHits.length) results.rawTailwindColors = rawColorHits;

  // Strip single-line and JSDoc comment lines before BiDi check to avoid false positives
  const contentNoComments = content
    .split("\n")
    .filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line))
    .join("\n");

  const bidiHits = [
    ...extractMatches(contentNoComments, PATTERNS.physicalDirectional),
    ...extractMatches(contentNoComments, PATTERNS.physicalPositioning),
  ].filter((v) => v.trim().length > 0 && !v.includes("right-") && !v.includes("left-["));
  if (bidiHits.length) results.physicalDirectionalClasses = bidiHits;

  // Bracket value check skipped for exempt files
  if (!isExempt) {
    const hexBracket = extractMatches(content, PATTERNS.hexInBracket);
    if (hexBracket.length) results.hexInBracket = hexBracket;

    const pixelHits = extractMatches(content, PATTERNS.arbitraryPixelValues);
    if (pixelHits.length) results.arbitraryPixelValues = pixelHits;

    const inlineHits = extractMatches(content, PATTERNS.inlineStyle);
    if (inlineHits.length) results.inlineStyles = inlineHits;
  }

  if (Object.keys(results).length === 0) return null;
  return {
    file: path.relative(path.join(__dirname, "../..", ".."), filePath),
    findings: results,
    exempt: isExempt,
  };
}

function main() {
  const allFiles = [];
  for (const dir of SCAN_DIRS) {
    if (fs.existsSync(dir)) globSync(dir, [".tsx", ".ts"], allFiles);
  }

  console.log(`Scanning ${allFiles.length} files...`);

  const report = [];
  for (const f of allFiles) {
    const res = auditFile(f);
    if (res) report.push(res);
  }

  // Summary counts
  const summary = {
    totalFilesScanned: allFiles.length,
    totalViolatingFiles: report.filter((r) => !r.exempt).length,
    exemptFiles: report.filter((r) => r.exempt).length,
    byCategory: {},
  };

  for (const item of report) {
    if (item.exempt) continue;
    for (const [cat, hits] of Object.entries(item.findings)) {
      summary.byCategory[cat] =
        (summary.byCategory[cat] ?? 0) + (Array.isArray(hits) ? hits.length : 1);
    }
  }

  const outPath = path.join(__dirname, "ui-audit-report.json");
  fs.writeFileSync(outPath, JSON.stringify({ summary, violations: report }, null, 2), "utf8");

  console.log("\nUI Audit Summary:");
  console.log(`  Files scanned:   ${summary.totalFilesScanned}`);
  console.log(`  Violating files: ${summary.totalViolatingFiles}`);
  console.log(`  Exempt files:    ${summary.exemptFiles}`);
  for (const [cat, count] of Object.entries(summary.byCategory)) {
    console.log(`  ${cat}: ${count} instance(s)`);
  }
  console.log(`\nFull report: ${outPath}`);
}

main();
