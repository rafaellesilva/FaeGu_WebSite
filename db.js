import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { restoreIfMissing } from "./backup.js";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
const legacyFile = join(dataDir, "db.json");

// Em produção o banco fica fora da pasta do app (DATABASE_FILE), para sobreviver aos deploys.
export const databaseFile = process.env.DATABASE_FILE || join(dataDir, "site.db");
mkdirSync(dirname(databaseFile), { recursive: true });
await restoreIfMissing(databaseFile);

export const db = new DatabaseSync(databaseFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    userId TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    eventType TEXT NOT NULL DEFAULT '',
    eventDate TEXT NOT NULL DEFAULT '',
    guests INTEGER,
    menuPackage TEXT NOT NULL DEFAULT '',
    menuItems TEXT NOT NULL DEFAULT '[]',
    estimate REAL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    createdAt TEXT NOT NULL,
    updatedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS quotes_userId ON quotes(userId);
`);

const insertUserSql = `INSERT OR IGNORE INTO users (id, name, email, passwordHash, role, createdAt)
  VALUES (:id, :name, :email, :passwordHash, :role, :createdAt)`;
const insertQuoteSql = `INSERT OR IGNORE INTO quotes
  (id, userId, name, email, phone, eventType, eventDate, guests, menuPackage, menuItems, estimate, message, status, createdAt, updatedAt)
  VALUES (:id, :userId, :name, :email, :phone, :eventType, :eventDate, :guests, :menuPackage, :menuItems, :estimate, :message, :status, :createdAt, :updatedAt)`;

export function quoteParams(quote) {
  return {
    id: quote.id,
    userId: quote.userId ?? null,
    name: quote.name,
    email: quote.email,
    phone: quote.phone ?? "",
    eventType: quote.eventType ?? "",
    eventDate: quote.eventDate ?? "",
    guests: quote.guests ?? null,
    menuPackage: quote.menuPackage ?? "",
    menuItems: JSON.stringify(quote.menuItems ?? []),
    estimate: quote.estimate ?? null,
    message: quote.message,
    status: quote.status ?? "new",
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt ?? null,
  };
}

export function rowToQuote(row) {
  const { updatedAt, menuItems, ...rest } = row;
  const quote = { ...rest, menuItems: JSON.parse(menuItems) };
  if (updatedAt) quote.updatedAt = updatedAt;
  return quote;
}

export const queries = {
  insertUser: db.prepare(insertUserSql),
  insertQuote: db.prepare(insertQuoteSql),
  userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  userById: db.prepare("SELECT * FROM users WHERE id = ?"),
  allUsers: db.prepare(`SELECT users.id, users.name, users.email, users.role, users.createdAt, COUNT(quotes.id) AS quoteCount
    FROM users LEFT JOIN quotes ON quotes.userId = users.id
    GROUP BY users.id ORDER BY users.createdAt DESC`),
  updateUserRole: db.prepare("UPDATE users SET role = ? WHERE id = ?"),
  updateUserPassword: db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?"),
  deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
  allQuotes: db.prepare("SELECT * FROM quotes ORDER BY createdAt DESC"),
  quotesByUser: db.prepare("SELECT * FROM quotes WHERE userId = ? ORDER BY createdAt DESC"),
  quoteById: db.prepare("SELECT * FROM quotes WHERE id = ?"),
  updateQuoteStatus: db.prepare("UPDATE quotes SET status = ?, updatedAt = ? WHERE id = ?"),
};

// Importação única do antigo data/db.json, só se o banco ainda estiver vazio.
function importLegacyJson() {
  if (!existsSync(legacyFile)) return;
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  const { q } = db.prepare("SELECT COUNT(*) AS q FROM quotes").get();
  if (n > 0 || q > 0) return;

  const legacy = JSON.parse(readFileSync(legacyFile, "utf8"));
  db.exec("BEGIN");
  try {
    for (const user of legacy.users || []) queries.insertUser.run({ role: "client", ...user });
    for (const quote of legacy.quotes || []) queries.insertQuote.run(quoteParams(quote));
    db.exec("COMMIT");
    console.log(`Importados ${legacy.users?.length || 0} usuários e ${legacy.quotes?.length || 0} orçamentos de data/db.json.`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

importLegacyJson();
