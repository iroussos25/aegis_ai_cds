import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "env:check"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
];

for (const [command, args] of steps) {
  console.log(`\n[recruiter-check] Running: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n[recruiter-check] All checks passed. Project is recruiter-ready.");
