// aux4/uptime has no third-party runtime dependencies (pure Node builtins), so
// the "build" is just copying the entrypoint into the package's lib/ directory.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "bin", "executable.js");
const dest = path.join(root, "package", "lib", "uptime.mjs");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
