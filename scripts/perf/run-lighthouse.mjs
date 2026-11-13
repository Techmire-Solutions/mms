import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const perfBaselineDir = path.resolve(repoRoot, "perf/baseline");
const frontendDir = path.resolve(repoRoot, "apps/frontend");

fs.mkdirSync(perfBaselineDir, { recursive: true });

function findBrowserBinary() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(localAppData, "ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe"),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }

  return null;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        return;
      }
    } catch {
      // Wait for server to come up
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  console.log("=== Step 1: Building web app for production (ANALYZE=1) ===");
  const buildEnv = {
    ...process.env,
    ANALYZE: "1",
  };

  const buildResult = spawnSync("pnpm", ["--filter", "mms-frontend", "build"], {
    cwd: repoRoot,
    env: buildEnv,
    stdio: "inherit",
    shell: true,
  });

  if (buildResult.status !== 0) {
    console.error("Build failed with code", buildResult.status);
    process.exit(buildResult.status || 1);
  }

  // Copy bundle visualizer report to perf/baseline/bundle.html if generated
  const distStatsHtml = path.resolve(frontendDir, "dist/stats.html");
  const targetBundleHtml = path.resolve(perfBaselineDir, "bundle.html");
  if (fs.existsSync(distStatsHtml)) {
    fs.copyFileSync(distStatsHtml, targetBundleHtml);
    console.log(`Copied bundle visualizer report to ${targetBundleHtml}`);
  } else {
    console.warn(`Warning: stats.html not found at ${distStatsHtml}`);
  }

  console.log("=== Step 2: Serving web app with vite preview ===");
  const port = 4173;
  const previewUrl = `http://localhost:${port}/`;

  const previewProcess = spawn(
    "pnpm",
    ["--filter", "mms-frontend", "exec", "vite", "preview", "--port", String(port), "--strictPort"],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    },
  );

  previewProcess.stdout?.on("data", (d) => {
    // console.log(`[preview] ${d.toString()}`);
  });
  previewProcess.stderr?.on("data", (d) => {
    // console.error(`[preview-err] ${d.toString()}`);
  });

  try {
    await waitForServer(previewUrl, 30000);
    console.log(`Preview server ready at ${previewUrl}`);

    const browserPath = findBrowserBinary();
    if (browserPath) {
      console.log(`Using browser binary: ${browserPath}`);
    } else {
      console.warn(
        "No browser binary explicitly found. Lighthouse will attempt default discovery.",
      );
    }

    const lhEnv = {
      ...process.env,
      ...(browserPath ? { CHROME_PATH: browserPath } : {}),
    };

    console.log("=== Step 3: Running Lighthouse (Mobile) in clean profile ===");
    const mobileReportPath = path.resolve(perfBaselineDir, "mobile.report.json");
    const mobileArgs = [
      "--yes",
      "lighthouse",
      previewUrl,
      "--output=json",
      `--output-path=${mobileReportPath}`,
      "--form-factor=mobile",
      "--throttling-method=simulate",
      '--chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"',
      "--quiet",
    ];

    const mobileLh = spawnSync("npx", mobileArgs, {
      cwd: repoRoot,
      env: lhEnv,
      stdio: "inherit",
      shell: true,
    });

    if (mobileLh.status !== 0) {
      console.error("Lighthouse mobile run failed with code", mobileLh.status);
    } else {
      console.log(`Saved mobile report to ${mobileReportPath}`);
    }

    console.log("=== Step 4: Running Lighthouse (Desktop) in clean profile ===");
    const desktopReportPath = path.resolve(perfBaselineDir, "desktop.report.json");
    const desktopArgs = [
      "--yes",
      "lighthouse",
      previewUrl,
      "--output=json",
      `--output-path=${desktopReportPath}`,
      "--preset=desktop",
      '--chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage"',
      "--quiet",
    ];

    const desktopLh = spawnSync("npx", desktopArgs, {
      cwd: repoRoot,
      env: lhEnv,
      stdio: "inherit",
      shell: true,
    });

    if (desktopLh.status !== 0) {
      console.error("Lighthouse desktop run failed with code", desktopLh.status);
    } else {
      console.log(`Saved desktop report to ${desktopReportPath}`);
    }

    console.log("=== Lighthouse runs complete ===");
  } finally {
    console.log("Stopping preview server...");
    if (process.platform === "win32" && previewProcess.pid) {
      spawnSync("taskkill", ["/pid", String(previewProcess.pid), "/f", "/t"]);
    } else {
      previewProcess.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error("Error running perf:lh:", err);
  process.exit(1);
});
