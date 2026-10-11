// UI Audit Script for MMS Frontend (CommonJS)
// Scans apps/frontend/src/routes/**/*.tsx for UI patterns
// Outputs JSON report to apps/frontend/scripts/ui-audit-report.json

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const ROUTES_GLOB = path.join(__dirname, "..", "src", "routes", "**", "*.{tsx,jsx,ts,js}");

// Regex patterns to detect UI anti‑patterns
const patterns = {
  tableHeaders: /<th[^>]*>([^<]+)<\/th>/g,
  customCards: /<\w+Card[^>]*>/g,
  hardcodedColors: /#([0-9a-fA-F]{3,6})/g,
  bracketTailwind: /\[[^\]]+\]/g,
  inlineStyle: /style=\{[^}]*\}/g,
  rawTailwindColors: /bg-(red|blue|gray|slate|green|yellow|purple|pink)-\d{2,3}/g,
  rawTailwindSpacing: /p-\[?\d+\]?/g,
};

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const findings = {};
  for (const [key, regex] of Object.entries(patterns)) {
    const matches = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
      matches.push(m[0]);
    }
    if (matches.length) findings[key] = matches;
  }
  return Object.keys(findings).length ? { file: filePath, findings } : null;
}

function main() {
  const files = glob.sync(ROUTES_GLOB, { nodir: true });
  const report = [];
  files.forEach((f) => {
    const res = auditFile(f);
    if (res) report.push(res);
  });
  const outPath = path.join(__dirname, "ui-audit-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log("UI audit completed. Report written to", outPath);
}

main();
