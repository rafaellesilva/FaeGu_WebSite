// Gera deploy/fa-gu-<data>.zip para enviar no console do Elastic Beanstalk.
// Rode com "npm run bundle" (que faz o build do site antes).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const files = ["dist", "scripts", ".ebextensions", "Procfile", "package.json", "package-lock.json", "server.js", "db.js", "backup.js", "mailer.js"];
const missing = files.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Arquivos faltando: ${missing.join(", ")}. Rode "npm run bundle" na pasta do projeto.`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const output = join("deploy", `fa-gu-${stamp}.zip`);
mkdirSync("deploy", { recursive: true });
rmSync(output, { force: true });

// O tar do Windows 10+ gera .zip com caminhos no formato que o Linux da AWS entende.
if (process.platform === "win32") {
  execFileSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-a", "-cf", output, ...files], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-qr", output, ...files], { stdio: "inherit" });
}
console.log(`Pacote pronto: ${output}`);
