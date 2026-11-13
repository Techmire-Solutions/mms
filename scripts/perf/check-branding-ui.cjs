const fs = require("fs");

const code = fs.readFileSync("apps/frontend/dist/assets/brandingTheme-eO3vukqX.js", "utf8");
const idx = code.indexOf("vendor-ui");
const sub = code.substring(idx - 60, idx + 200);
console.log(sub);
