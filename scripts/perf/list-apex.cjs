const fs = require("fs");
const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

const target = "assets/apexPlatformTheme-KYk1nXvs.js";
const idx = html.indexOf(target);
console.log("apexPlatformTheme chunk idx:", idx);
const nextChunkIdx = html.indexOf('{"name":"assets/', idx + target.length);
console.log("next chunk idx:", nextChunkIdx);

const chunkSlice = html.substring(idx, nextChunkIdx);
const matches = [...chunkSlice.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);
console.log("Files in apexPlatformTheme chunk:");
matches.forEach((m) => {
  if (m.endsWith(".ts") || m.endsWith(".js") || m.endsWith(".tsx") || m.endsWith(".mjs")) {
    console.log("  -", m);
  }
});
