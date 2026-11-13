const fs = require("fs");
const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

const target = "brandingTheme-";
const idx = html.indexOf(target);
console.log("brandingTheme idx:", idx);
if (idx !== -1) {
  const chunkStart = html.lastIndexOf('{"name":"assets/', idx);
  const nextChunk = html.indexOf('{"name":"assets/', idx + 20);
  const chunkSlice = html.substring(chunkStart, nextChunk !== -1 ? nextChunk : idx + 5000);
  const matches = [...chunkSlice.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);
  console.log("Files in brandingTheme:");
  matches.forEach((m) => console.log("  -", m));
}
