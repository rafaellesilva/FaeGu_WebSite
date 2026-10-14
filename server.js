import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { queries, quoteParams, rowToQuote } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "development-secret-change-me";
const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = isProduction
  ? configuredOrigins
  : [...new Set([...configuredOrigins, "http://localhost:5173", "http://127.0.0.1:5173"])];

if (isProduction && jwtSecret === "development-secret-change-me") {
  throw new Error("JWT_SECRET precisa ser configurado em produção.");
}

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
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

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  if (queries.userByEmail.get(adminEmail)) return;

  queries.insertUser.run({
    id: randomUUID(),
    name: process.env.ADMIN_NAME?.trim() || "Administrador",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    createdAt: new Date().toISOString(),
  });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function setAuthCookie(response, user) {
  response.cookie("fa_gu_session", issueToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function requireAuth(request, response, next) {
  const token = request.cookies?.fa_gu_session;
  if (!token) return response.status(401).json({ error: "Autenticação necessária." });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = queries.userById.get(payload.sub);
    if (!user) return response.status(401).json({ error: "Sessão inválida." });
    request.user = user;
    next();
  } catch {
    return response.status(401).json({ error: "Sessão expirada ou inválida." });
  }
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

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.post("/api/auth/register", async (request, response, next) => {
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

app.post("/api/auth/login", async (request, response, next) => {
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
  response.clearCookie("fa_gu_session");
  response.status(204).end();
});

app.get("/api/auth/me", requireAuth, (request, response) => response.json({ user: publicUser(request.user) }));

app.post("/api/quotes", async (request, response, next) => {
  try {
    const { name, email, phone, eventType, eventDate, guests, menuPackage, menuItems, estimate, message } = request.body || {};
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    if (!normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !normalizedMessage) {
      return response.status(400).json({ error: "Nome, e-mail e mensagem são obrigatórios." });
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
      userId: request.user?.id || null,
      name: normalizedName,
      email: normalizedEmail,
      phone: String(phone || "").trim(),
      eventType: String(eventType || "").trim(),
      eventDate: String(eventDate || "").trim(),
      guests: parsedGuests || null,
      menuPackage: String(menuPackage || "").trim(),
      menuItems: Array.isArray(menuItems) ? menuItems.map((item) => String(item).trim()).filter(Boolean) : [],
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

app.get("/api/quotes", requireAuth, requireAdmin, async (_request, response, next) => {
  try {
    return response.json({ quotes: queries.allQuotes.all().map(rowToQuote) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/my/quotes", requireAuth, async (request, response, next) => {
  try {
    return response.json({ quotes: queries.quotesByUser.all(request.user.id).map(rowToQuote) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/quotes/:id", requireAuth, requireAdmin, async (request, response, next) => {
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

const distDir = join(dirname(fileURLToPath(import.meta.url)), "dist");
if (existsSync(distDir)) app.use(express.static(distDir));

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error.type === "entity.parse.failed" ? 400 : 500;
  response.status(status).json({ error: status === 400 ? "JSON inválido." : "Erro interno do servidor." });
});

ensureAdminUser()
  .then(() => app.listen(port, () => console.log(`Fa & Gu API disponível em http://localhost:${port}`)))
  .catch((error) => {
    console.error("Não foi possível preparar o banco local.", error);
    process.exitCode = 1;
  });