// Configuração compartilhada dos testes E2E: servidor de teste, admin de teste e pasta temporária.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TEST_PORT = 3100;
export const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TMP_DIR = join(ROOT, "tests", "e2e", ".tmp");
export const SERVER_LOG = join(TMP_DIR, "server.log");

// Só existe no banco de teste; nunca é uma conta real.
export const TEST_ADMIN = { name: "Admin E2E", email: "admin.e2e@teste.local", password: "Senha-Admin-E2E-2026" };
