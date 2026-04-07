import { existsSync, cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const baseDir = path.dirname(fileURLToPath(import.meta.url));
const standaloneDir = findStandaloneDir(baseDir);
syncStaticAssets(baseDir, standaloneDir);
const candidates = [
  path.join(standaloneDir, "server.js"),
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
    HOSTNAME: "0.0.0.0"
  },
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

function findStandaloneDir(baseDir) {
  const candidates = [
    path.join(baseDir, ".next/standalone/apps/web"),
    path.join(baseDir, ".next/standalone")
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

function syncStaticAssets(baseDir, standaloneDir) {
  const publicSrc = path.join(baseDir, "public");
  const publicDest = path.join(standaloneDir, "public");
  const staticSrc = path.join(baseDir, ".next/static");
  const staticDest = path.join(standaloneDir, ".next/static");

  if (existsSync(publicSrc)) {
    mkdirSync(publicDest, { recursive: true });
    cpSync(publicSrc, publicDest, { recursive: true, force: true });
  }

  if (existsSync(staticSrc)) {
    mkdirSync(staticDest, { recursive: true });
    cpSync(staticSrc, staticDest, { recursive: true, force: true });
  }
}
