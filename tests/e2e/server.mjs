// Sobe o site para os testes E2E com um banco temporário (tests/e2e/.tmp), sem tocar em data/ nem nos dados reais.
// Usado pelo webServer do playwright.config.js.
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { ROOT, SERVER_LOG, TEST_ADMIN, TEST_PORT, TMP_DIR } from "./config.js";

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

// O banco já nasce com o admin de teste. Com isso o db.js não importa o data/db.json (dados reais) para cá,
// porque essa importação só acontece com o banco vazio.
const databaseFile = join(TMP_DIR, "e2e.db");
const database = new DatabaseSync(databaseFile);
database.exec(`CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  createdAt TEXT NOT NULL
)`);
database
  .prepare("INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, 'admin', ?)")
  .run(randomUUID(), TEST_ADMIN.name, TEST_ADMIN.email, bcrypt.hashSync(TEST_ADMIN.password, 10), new Date().toISOString());
database.close();

// Build do front-end, igual ao de produção (o server.js serve a pasta dist/).
execFileSync(process.execPath, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "warn"], {
  cwd: ROOT,
  stdio: "inherit",
});

const log = createWriteStream(SERVER_LOG);
const server = spawn(process.execPath, ["server.js"], {
  cwd: ROOT,
  // Valores explícitos: o dotenv do server.js não sobrescreve variáveis já definidas, então o .env real é ignorado.
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(TEST_PORT),
    DATABASE_FILE: databaseFile,
    JWT_SECRET: "e2e-segredo-de-teste-que-nao-e-o-de-producao",
    ADMIN_EMAIL: TEST_ADMIN.email,
    ADMIN_PASSWORD: TEST_ADMIN.password,
    ADMIN_NAME: TEST_ADMIN.name,
    BACKUP_BUCKET: "",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    COOKIE_SECURE: "false",
    TRUST_PROXY: "1",
    CLIENT_ORIGIN: `http://127.0.0.1:${TEST_PORT}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
writeFileSync(join(TMP_DIR, "server.pid"), String(server.pid));
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
}

const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
server.on("exit", (code) => process.exit(code ?? 0));
