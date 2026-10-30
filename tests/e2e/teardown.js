// Limpeza ao final: encerra o servidor de teste (se ainda estiver de pé) e apaga o banco e os logs temporários.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { TMP_DIR } from "./config.js";

export default async function teardown() {
  if (process.env.E2E_KEEP_TMP) return;
  const pidFile = join(TMP_DIR, "server.pid");
  if (existsSync(pidFile)) {
    try {
      process.kill(Number(readFileSync(pidFile, "utf8")));
    } catch {
      // Já tinha sido encerrado.
    }
  }
  // No Windows o arquivo do SQLite pode levar um instante para ser liberado.
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(TMP_DIR, { recursive: true, force: true });
      return;
    } catch {
      await sleep(500);
    }
  }
}
