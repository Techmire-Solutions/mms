const fs = require("fs");
const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

function findWhoUses(target) {
  let idx = 0;
  while ((idx = html.indexOf(target, idx)) !== -1) {
    const parentStart = html.lastIndexOf('"name":"', idx);
    const parentEnd = html.indexOf('"', parentStart + 8);
    console.log(
      "found target at",
      idx,
      "parent/context:",
      html.substring(parentStart, parentEnd + 1),
    );
    idx += target.length;
  }
}

findWhoUses("packages/shared/dist/contracts/index.js");
