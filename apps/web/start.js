import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const baseDir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(baseDir, ".next/standalone/apps/web/server.js"),
  path.join(baseDir, ".next/standalone/server.js")
];
const serverPath = candidates.find((path) => existsSync(path));

if (!serverPath) {
  console.error(`[start] Missing standalone server.js. Checked: ${candidates.join(", ")}`);
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0"
  },
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
