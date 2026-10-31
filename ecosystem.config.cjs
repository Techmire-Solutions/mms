/** @type {import('pm2').StartOptions} */
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = __dirname;
const backendEnvPath = path.join(root, "apps/backend/.env");
const backendPort = process.env.PORT || "5002";

/** @type {Record<string, string>} */
const backendEnv = {
  NODE_ENV: "production",
  PORT: backendPort,
  PUPPETEER_SKIP_DOWNLOAD: "true",
};

if (fs.existsSync(backendEnvPath)) {
  for (const line of fs.readFileSync(backendEnvPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    backendEnv[key] = value;
  }
}

// PM2 cluster mode opens one pool per instance. Derive the per-process pool from
// the server's connection budget so N instances cannot exhaust Postgres.
const requestedInstances = process.env.PM2_INSTANCES;
const apiInstances = requestedInstances
  ? Number(requestedInstances) || requestedInstances
  : Math.min(os.cpus().length, 4);
const instanceCount = typeof apiInstances === "number" ? Math.max(1, apiInstances) : 1;
const maxDbConnections = Number(process.env.PG_MAX_CONNECTIONS || 100);
const workerPool = 10;
const derivedPool = Math.max(5, Math.floor((maxDbConnections - workerPool) / instanceCount));
backendEnv.PG_POOL_MAX = String(derivedPool);

module.exports = {
  apps: [
    {
      name: "mmsv2-backend",
      cwd: root,
      script: path.join(root, "apps/backend/dist/index.js"),
      instances: apiInstances,
      exec_mode: process.env.PM2_EXEC_MODE || "cluster",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      kill_timeout: 70000,
      max_memory_restart: "1800M",
      node_args: "--max-old-space-size=1536",
      time: true,
      merge_logs: true,
      error_file: path.join(root, ".logs/pm2-backend-error.log"),
      out_file: path.join(root, ".logs/pm2-backend-out.log"),
      env: Object.assign({ RATE_LIMIT_REDIS_STORE: "true" }, backendEnv),
    },
    {
      name: "mmsv2-worker",
      cwd: root,
      script: path.join(root, "apps/backend/dist/worker/index.js"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      // 15s above WORKER_FORCE_EXIT_MS (75s): the process exits before SIGKILL.
      kill_timeout: 90000,
      max_memory_restart: "1800M",
      node_args: "--max-old-space-size=1536",
      time: true,
      merge_logs: true,
      error_file: path.join(root, ".logs/pm2-worker-error.log"),
      out_file: path.join(root, ".logs/pm2-worker-out.log"),
      env: backendEnv,
    },
  ],
};
