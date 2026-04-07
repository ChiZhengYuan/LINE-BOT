import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const candidates = [
  ".next/standalone/apps/web/server.js",
  ".next/standalone/server.js"
];
const serverPath = candidates.find((path) => existsSync(path));

if (!serverPath) {
  console.error(`[start] Missing standalone server.js. Run the build step first.`);
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
