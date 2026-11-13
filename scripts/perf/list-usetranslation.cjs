const fs = require("fs");
const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

const target = "assets/useTranslation-B17qaVYW.js";
const idx = html.indexOf(target);
console.log("useTranslation chunk idx:", idx);
const nextChunkIdx = html.indexOf('{"name":"assets/', idx + target.length);
console.log("next chunk idx:", nextChunkIdx);

const chunkSlice = html.substring(idx, nextChunkIdx);
// find all file names in this slice: "name":"..."
const matches = [...chunkSlice.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);
console.log("Total files in useTranslation chunk:", matches.length);
matches.forEach((m) => {
  if (m.endsWith(".ts") || m.endsWith(".js") || m.endsWith(".tsx") || m.endsWith(".mjs")) {
    console.log("  -", m);
  }
});
