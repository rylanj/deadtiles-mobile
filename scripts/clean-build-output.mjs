/**
 * Drop compiled output before a VPS build.
 * Dist is not part of the upload that matters, and a leftover
 * packages/shared/dist makes tsc typecheck the server against old
 * declarations. That shows up as a long list of "has no exported member".
 */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const paths = [
  "packages/shared/dist",
  "packages/server/dist",
  "packages/shared/tsconfig.tsbuildinfo",
  "packages/server/tsconfig.tsbuildinfo",
];

for (const rel of paths) {
  rmSync(join(root, rel), { recursive: true, force: true });
}
