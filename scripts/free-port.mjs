/**
 * Frees a TCP port before starting the dev server.
 * Usage: node scripts/free-port.mjs [port]
 * Env: PORT (overrides default 2567)
 */
import { execSync } from "node:child_process";

const DEFAULT_PORT = 2567;
const port = Number(process.argv[2] ?? process.env.PORT ?? DEFAULT_PORT);
const selfPid = process.pid;

function pidsListeningOnPort(targetPort) {
  if (process.platform === "win32") {
    let out = "";
    try {
      out = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
    } catch {
      return [];
    }

    const pids = new Set();
    const portToken = `:${targetPort}`;
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING") || !line.includes(portToken)) continue;
      const local = line.trim().split(/\s+/)[1] ?? "";
      if (!local.endsWith(`:${targetPort}`) && !local.endsWith(`:${targetPort}]`)) {
        continue;
      }
      const pid = Number(line.trim().split(/\s+/).at(-1));
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -nP -iTCP:${targetPort} -sTCP:LISTEN -t`, {
      encoding: "utf8",
    });
    return out
      .split(/\r?\n/)
      .map((s) => Number(s.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (pid === selfPid) return false;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    return true;
  } catch {
    return false;
  }
}

const pids = pidsListeningOnPort(port).filter((pid) => pid !== selfPid);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  if (killPid(pid)) {
    console.log(`[free-port] freed port ${port} (stopped pid ${pid})`);
  }
}

// Brief pause so Windows releases the socket before the server binds.
if (process.platform === "win32") {
  execSync("powershell -NoProfile -Command \"Start-Sleep -Milliseconds 300\"");
}
