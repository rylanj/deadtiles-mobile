/**
 * Rebuild @zombie/shared and @zombie/server when dist is missing or older than
 * source. Dist is gitignored, so a VPS git pull never ships compiled output.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

if (buildShared) {
  console.log("[ensure-build] compiling @zombie/shared (dist missing or stale)");
  execSync("npm run build -w @zombie/shared", { cwd: root, stdio: "inherit" });
}

if (buildServer) {
  console.log("[ensure-build] compiling @zombie/server (dist missing or stale)");
  execSync("npx tsc -p tsconfig.json", {
    cwd: join(root, "packages/server"),
    stdio: "inherit",
  });
}
