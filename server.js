import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, queries, quoteParams, rowToQuote } from "./db.js";
import { backupToS3, backupsEnabled, snapshot } from "./backup.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "development-secret-change-me";
const isProduction = process.env.NODE_ENV === "production";
const secureCookies = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction;
const backupIntervalMinutes = Number(process.env.BACKUP_INTERVAL_MINUTES || 15);
const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = isProduction
  ? configuredOrigins
  : [...new Set([...configuredOrigins, "http://localhost:5173", "http://127.0.0.1:5173"])];

if (isProduction && (jwtSecret === "development-secret-change-me" || jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET precisa ser configurado em produção, com pelo menos 32 caracteres.");
}

// Na AWS o app fica atrás do nginx (e do load balancer); sem isso todos os acessos
// pareceriam vir do mesmo IP e o limite de tentativas bloquearia todo mundo junto.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use((_request, response, next) => {
  response.header("X-Content-Type-Options", "nosniff");
  response.header("X-Frame-Options", "DENY");
  response.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (secureCookies) response.header("Strict-Transport-Security", "max-age=15552000");
  next();
});
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.header("Access-Control-Allow-Origin", origin);
    response.header("Vary", "Origin");
  }
  response.header("Access-Control-Allow-Credentials", "true");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  response.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

const limiterOptions = { standardHeaders: "draft-8", legacyHeaders: false };
const authLimiter = rateLimit({
  ...limiterOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});
const quoteLimiter = rateLimit({
  ...limiterOptions,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: "Muitos pedidos enviados. Tente novamente mais tarde ou fale conosco pelo WhatsApp." },
});

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const existing = queries.userByEmail.get(adminEmail);
  if (existing) {
    // Não promove automaticamente: quem cadastrou esse e-mail pelo site escolheu a senha.
    if (existing.role !== "admin") {
      console.warn(`ADMIN_EMAIL ${adminEmail} já existe como cliente. Use "node scripts/admin.js promover" se for mesmo você.`);
    }
    return;
  }
  if (adminPassword.length < 12) throw new Error("ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.");

  queries.insertUser.run({
    id: randomUUID(),
    name: process.env.ADMIN_NAME?.trim() || "Administrador",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    createdAt: new Date().toISOString(),
  });
  console.log(`Administrador ${adminEmail} criado.`);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

const cookieOptions = { httpOnly: true, sameSite: "lax", secure: secureCookies };

function setAuthCookie(response, user) {
  response.cookie("fa_gu_session", issueToken(user), { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function userFromSession(request) {
  const token = request.cookies?.fa_gu_session;
  if (!token) return null;
  try {
    return queries.userById.get(jwt.verify(token, jwtSecret).sub) || null;
  } catch {
    return null;
  }
}

function requireAuth(request, response, next) {
  const user = userFromSession(request);
  if (!user) return response.status(401).json({ error: "Sessão expirada ou inválida." });
  request.user = user;
  next();
}

function requireAdmin(request, response, next) {
  if (request.user.role !== "admin") return response.status(403).json({ error: "Acesso restrito." });
  next();
}

function validateCredentials(body) {
  if (!body || typeof body !== "object") return { error: "Dados inválidos." };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Informe um e-mail válido." };
  }
  if (password.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };
  if (password.length > 128) return { error: "A senha não pode ter mais de 128 caracteres." };
  if (name.length > 120) return { error: "O nome não pode ter mais de 120 caracteres." };
  return { name, email, password };
}

// CSV com ";" e BOM, que é o formato que o Excel em português abre direto.
function toCsv(columns, rows) {
  const cell = (value) => {
    let text = value === null || value === undefined ? "" : String(value);
    // Impede que o Excel interprete o conteúdo enviado por visitantes como fórmula.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [
    columns.map(([, label]) => cell(label)).join(";"),
    ...rows.map((row) => columns.map(([key]) => cell(row[key])).join(";")),
  ];
  return `﻿${lines.join("\r\n")}`;
}

function sendCsv(response, name, csv) {
  const date = new Date().toISOString().slice(0, 10);
  response.attachment(`${name}-${date}.csv`).type("text/csv; charset=utf-8").send(csv);
}

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.post("/api/auth/register", authLimiter, async (request, response, next) => {
  try {
    const credentials = validateCredentials(request.body || {});
    if (credentials.error) return response.status(400).json(credentials);
    if (!credentials.name) return response.status(400).json({ error: "Informe seu nome." });

    if (queries.userByEmail.get(credentials.email)) {
      return response.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const user = {
      id: randomUUID(),
      name: credentials.name,
      email: credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, 12),
      role: "client",
      createdAt: new Date().toISOString(),
    };
    queries.insertUser.run(user);
    setAuthCookie(response, user);
    return response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const user = queries.userByEmail.get(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: "E-mail ou senha inválidos." });
    }
    setAuthCookie(response, user);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie("fa_gu_session", cookieOptions);
  response.status(204).end();
});

app.get("/api/auth/me", requireAuth, (request, response) => response.json({ user: publicUser(request.user) }));

// Simulações só com cadastro; nome e e-mail caem para os da conta quando não vierem no body.
app.post("/api/quotes", quoteLimiter, requireAuth, async (request, response, next) => {
  try {
    const { name, email, phone, eventType, eventDate, guests, menuPackage, menuItems, estimate, message } = request.body || {};
    const normalizedName = (typeof name === "string" && name.trim()) || request.user.name;
    const normalizedEmail = ((typeof email === "string" && email.trim()) || request.user.email).toLowerCase();
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    if (!normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedPhone.replace(/\D/g, "").length < 10 || !normalizedMessage) {
      return response.status(400).json({ error: "Nome, e-mail, telefone e mensagem são obrigatórios." });
    }
    if (normalizedName.length > 120 || normalizedEmail.length > 254 || normalizedMessage.length > 4000) {
      return response.status(400).json({ error: "Confira os limites dos campos enviados." });
    }
    const parsedGuests = Number(guests);
    if (guests !== undefined && guests !== null && (!Number.isInteger(parsedGuests) || parsedGuests < 1 || parsedGuests > 10000)) {
      return response.status(400).json({ error: "Quantidade de convidados inválida." });
    }
    const quote = {
      id: randomUUID(),
      userId: request.user.id,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone.slice(0, 40),
      eventType: String(eventType || "").trim().slice(0, 80),
      eventDate: String(eventDate || "").trim().slice(0, 40),
      guests: parsedGuests || null,
      menuPackage: String(menuPackage || "").trim().slice(0, 80),
      menuItems: Array.isArray(menuItems) ? menuItems.slice(0, 50).map((item) => String(item).trim().slice(0, 80)).filter(Boolean) : [],
      estimate: Number(estimate) || null,
      message: normalizedMessage,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    queries.insertQuote.run(quoteParams(quote));
    return response.status(201).json({ quote });
  } catch (error) {
    next(error);
  }
});

app.get("/api/quotes", requireAuth, requireAdmin, (_request, response, next) => {
  try {
    return response.json({ quotes: queries.allQuotes.all().map(rowToQuote) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/my/quotes", requireAuth, (request, response, next) => {
  try {
    return response.json({ quotes: queries.quotesByUser.all(request.user.id).map(rowToQuote) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/quotes/:id", requireAuth, requireAdmin, (request, response, next) => {
  try {
    const allowedStatuses = ["new", "contacted", "scheduled", "closed"];
    if (!allowedStatuses.includes(request.body?.status)) {
      return response.status(400).json({ error: "Status inválido." });
    }
    if (!queries.quoteById.get(request.params.id)) {
      return response.status(404).json({ error: "Orçamento não encontrado." });
    }
    queries.updateQuoteStatus.run(request.body.status, new Date().toISOString(), request.params.id);
    return response.json({ quote: rowToQuote(queries.quoteById.get(request.params.id)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, (_request, response, next) => {
  try {
    return response.json({ users: queries.allUsers.all() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/export/quotes.csv", requireAuth, requireAdmin, (_request, response, next) => {
  try {
    const rows = queries.allQuotes.all().map((row) => ({ ...rowToQuote(row), menuItems: JSON.parse(row.menuItems).join(", ") }));
    const columns = [
      ["createdAt", "Recebido em"], ["status", "Status"], ["name", "Nome"], ["email", "E-mail"], ["phone", "Telefone"],
      ["eventType", "Tipo de evento"], ["eventDate", "Data do evento"], ["guests", "Convidados"], ["menuPackage", "Pacote"],
      ["menuItems", "Adicionais"], ["estimate", "Estimativa (R$)"], ["message", "Mensagem"], ["userId", "ID do cliente"], ["id", "ID"],
    ];
    sendCsv(response, "orcamentos", toCsv(columns, rows));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/export/users.csv", requireAuth, requireAdmin, (_request, response, next) => {
  try {
    const columns = [
      ["createdAt", "Cadastrado em"], ["name", "Nome"], ["email", "E-mail"], ["role", "Perfil"], ["quoteCount", "Orçamentos"], ["id", "ID"],
    ];
    sendCsv(response, "clientes", toCsv(columns, queries.allUsers.all()));
  } catch (error) {
    next(error);
  }
});

// Cópia completa do banco (abre no "DB Browser for SQLite"). Contém hashes de senha: guarde com cuidado.
app.get("/api/admin/backup", requireAuth, requireAdmin, async (_request, response, next) => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    response.attachment(`fa-gu-banco-${date}.db`).type("application/vnd.sqlite3").send(await snapshot(db));
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_request, response) => response.status(404).json({ error: "Rota não encontrada." }));

const distDir = join(dirname(fileURLToPath(import.meta.url)), "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir, { extensions: ["html"] }));
} else if (isProduction) {
  console.warn("Pasta dist/ não encontrada: rode `npm run build` antes do deploy.");
}

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error.type === "entity.parse.failed" ? 400 : 500;
  response.status(status).json({ error: status === 400 ? "JSON inválido." : "Erro interno do servidor." });
});

async function runBackup(reason) {
  try {
    if (await backupToS3(db)) console.log(`Backup enviado ao S3 (${reason}).`);
  } catch (error) {
    console.error("Falha ao enviar backup ao S3.", error);
  }
}

ensureAdminUser()
  .then(() => {
    const server = app.listen(port, () => console.log(`Fa & Gu API disponível em http://localhost:${port}`));
    if (!backupsEnabled) {
      if (isProduction) console.warn("BACKUP_BUCKET não configurado: o banco NÃO está sendo copiado para o S3.");
      return;
    }
    runBackup("inicialização");
    setInterval(() => runBackup("periódico"), backupIntervalMinutes * 60 * 1000).unref();
    // A AWS envia SIGTERM em todo deploy/reinício: salva o estado antes de sair.
    process.once("SIGTERM", async () => {
      server.close();
      await runBackup("desligamento");
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error("Não foi possível preparar o banco local.", error);
    process.exitCode = 1;
  });
