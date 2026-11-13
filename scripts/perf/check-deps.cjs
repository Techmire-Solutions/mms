const fs = require("fs");

const html = fs.readFileSync("perf/baseline/bundle.html", "utf8");

function find(t) {
  let idx = 0;
  while ((idx = html.indexOf(t, idx)) !== -1) {
    const cStart = html.lastIndexOf("assets/", idx);
    const cEnd = html.indexOf('"', cStart);
    console.log(t, "->", html.substring(cStart, cEnd));
    idx += t.length;
  }
}

find("packages/shared/dist/index.js");
find("packages/shared/dist/entry/indexCore.js");
find("packages/shared/dist/entry/indexDomainsAcademic.js");
find("packages/shared/dist/entry/indexDomainsOperations.js");
find("packages/shared/dist/contracts/index.js");
