/**
 * Rebuild @zombie/shared and @zombie/server when dist is missing or older than
 * source. Dist is gitignored, so a VPS git pull never ships compiled output.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/assert-shared-ready.mjs", { cwd: root, stdio: "inherit" });

function newestMtime(dir) {
  let newest = 0;
  const walk = (p) => {
    let entries;
    try {
      entries = readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fp = join(p, entry.name);
      if (entry.isDirectory()) {
        walk(fp);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const t = statSync(fp).mtimeMs;
      if (t > newest) newest = t;
    }
  };
  walk(dir);
  return newest;
}

function needsBuild(srcDir, distFile) {
  if (!existsSync(distFile)) return true;
  return newestMtime(srcDir) > statSync(distFile).mtimeMs;
}

const buildShared = needsBuild(
  join(root, "packages/shared/src"),
  join(root, "packages/shared/dist/index.js"),
);
const buildServer =
  buildShared ||
  needsBuild(
    join(root, "packages/server/src"),
    join(root, "packages/server/dist/index.js"),
  );

if (!buildShared && !buildServer) {
  process.exit(0);
}

// Always compile shared before the server. `tsc -p` on the server does not
// rebuild project references, so a leftover dist from an older deploy makes
// WorldRoom fail typecheck (missing wetness, SKILL_XP, barterT, …).
if (buildShared || buildServer) {
  console.log("[ensure-build] compiling @zombie/shared");
  execSync("npx tsc -p tsconfig.json", {
    cwd: join(root, "packages/shared"),
    stdio: "inherit",
  });
}

if (buildServer) {
  console.log("[ensure-build] compiling @zombie/server (dist missing or stale)");
  execSync("npx tsc -p tsconfig.json", {
    cwd: join(root, "packages/server"),
    stdio: "inherit",
  });
}
