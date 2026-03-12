import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const lockPath = path.resolve(".next", "dev", "lock");

try {
  if (fs.existsSync(lockPath)) {
    fs.rmSync(lockPath, { force: true });
    console.log(`[dev-recover] Removed stale lock: ${lockPath}`);
  }
} catch (error) {
  console.warn("[dev-recover] Could not remove lock file:", error);
}

const child = spawn("npx next dev", {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
