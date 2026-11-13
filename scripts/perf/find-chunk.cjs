const fs = require("fs");
const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

// Find the node object for "packages/shared/dist/contracts/index.js"
const target = "packages/shared/dist/contracts/index.js";
const idx = html.indexOf(target);
console.log("idx:", idx);
if (idx !== -1) {
  // search backward for chunk name: {"name":"assets/..."
  const chunkStart = html.lastIndexOf('{"name":"assets/', idx);
  console.log("Chunk:", html.substring(chunkStart, chunkStart + 80));
}
