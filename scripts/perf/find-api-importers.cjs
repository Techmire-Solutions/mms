const fs = require("fs");
const path = require("path");

function walk(dir) {
  let files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== "node_modules" && ent.name !== "dist") {
        files.push(...walk(full));
      }
    } else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk("apps/frontend/src");
const importersOfApi = [];

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  if (content.match(/from\s+["']@\/lib\/api["']/)) {
    importersOfApi.push(f.replace(/\\/g, "/"));
  }
}

console.log("Total importers of @/lib/api:", importersOfApi.length);
importersOfApi.forEach((f) => console.log("  -", f));
