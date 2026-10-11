import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

const processes = [];
let shuttingDown = false;

/**
 * Resolves a dependency's bin entry to its JS file so it runs under `node`.
 * Spawning the `.bin/*.cmd` shims needs a shell on Windows (Node refuses with
 * EINVAL), and a shell breaks on paths with spaces.
 */
function binScript(packageDir, pkg, name) {
  const pkgJson = path.join(repoRoot, packageDir, 'node_modules', pkg, 'package.json');
  const { bin } = JSON.parse(readFileSync(pkgJson, 'utf8'));
  return path.join(path.dirname(pkgJson), typeof bin === 'string' ? bin : bin[name]);
}

function start(name, packageDir, command, args) {
  const child = spawn(command, args, {
    cwd: path.join(repoRoot, packageDir),
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-jwt-secret-key-at-least-32-chars-long',
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[e2e-web-server] ${name} exited with ${reason}`);
    shutdown(code ?? 1);
  });

  processes.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  console.error(error);
  shutdown(1);
});

async function waitForBackend(url, timeoutMs = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ignore network errors during backend startup
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Backend at ${url} failed to become ready within ${timeoutMs}ms`);
}

start('backend', 'apps/backend', process.execPath, [binScript('apps/backend', 'tsx', 'tsx'), 'src/index.ts']);
await waitForBackend('http://127.0.0.1:3000/ready');
start('frontend', 'apps/frontend', process.execPath, [binScript('apps/frontend', 'vite', 'vite'), '--host', '127.0.0.1']);

