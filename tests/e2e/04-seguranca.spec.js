// 4. SEGURANÇA E TENTATIVAS DE QUEBRAR: permissões, IDs trocados, XSS, SQL injection, senhas e segredos.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { ROOT, SERVER_LOG, TEST_ADMIN } from "./config.js";
import { adminApi, allQuotes, apiAs, createClient, createQuote, loginViaUi, personPage, quoteBody } from "./helpers.js";

const ADMIN_ROUTES = [
  ["GET", "/api/quotes"],
  ["PATCH", "/api/quotes/qualquer-id"],
  ["GET", "/api/admin/users"],
  ["DELETE", "/api/admin/users/qualquer-id"],
  ["GET", "/api/admin/export/quotes.csv"],
  ["GET", "/api/admin/export/quotes/qualquer-id.csv"],
  ["GET", "/api/admin/export/users.csv"],
  ["GET", "/api/admin/backup"],
];

const call = (api, method, path, data) => api.fetch(path, { method, data });

test.describe("acesso sem permissão", () => {
  test("APIs do admin: 401 sem login e 403 logado como cliente", async () => {
    const anonymous = await apiAs();
    const client = await apiAs(await createClient());
    const wrong = [];
    for (const [method, path] of ADMIN_ROUTES) {
      const anon = (await call(anonymous, method, path, { status: "closed" })).status();
      const asClient = (await call(client, method, path, { status: "closed" })).status();
      if (anon !== 401) wrong.push(`${method} ${path} sem login -> ${anon}`);
      if (asClient !== 403) wrong.push(`${method} ${path} como cliente -> ${asClient}`);
    }
    await anonymous.dispose();
    await client.dispose();
    expect(wrong).toEqual([]);
  });

  test("páginas protegidas redirecionam: visitante vai para o login, cliente não entra no painel", async ({ browser }) => {
    const visitor = await personPage(browser);
    await visitor.page.goto("/pages/admin.html");
    await expect(visitor.page).toHaveURL(/acesso/);
    await visitor.page.goto("/pages/minha-conta.html");
    await expect(visitor.page).toHaveURL(/acesso/);
    await visitor.context.close();

    const client = await createClient();
    const { context, page } = await personPage(browser);
    await loginViaUi(page, client);
    await expect(page).toHaveURL(/minha-conta/);
    await page.goto("/pages/admin.html");
    await expect(page).toHaveURL(/minha-conta/);
    await expect(page.locator("#admin-quote-list .admin-quote")).toHaveCount(0);
    await context.close();
  });

  test("um cliente não vê nem altera dados de outro (trocando IDs)", async () => {
    const alice = await createClient({ name: "Alice" });
    const bob = await createClient({ name: "Bob" });
    const aliceQuote = await createQuote(alice, { message: "pedido secreto da Alice" });
    const api = await apiAs(bob);
    const results = {
      "lista de Bob com ?userId da Alice": await (await api.get(`/api/my/quotes?userId=${alice.id}`)).text(),
      "PATCH no orçamento da Alice": (await api.patch(`/api/quotes/${aliceQuote.id}`, { data: { status: "closed" } })).status(),
      "CSV do orçamento da Alice": (await api.get(`/api/admin/export/quotes/${aliceQuote.id}.csv`)).status(),
      "DELETE da conta da Alice": (await api.delete(`/api/admin/users/${alice.id}`)).status(),
    };
    await api.dispose();
    expect(results["lista de Bob com ?userId da Alice"]).not.toContain("pedido secreto da Alice");
    expect(results["PATCH no orçamento da Alice"]).toBe(403);
    expect(results["CSV do orçamento da Alice"]).toBe(403);
    expect(results["DELETE da conta da Alice"]).toBe(403);
    const after = (await allQuotes()).find((quote) => quote.id === aliceQuote.id);
    expect(after.status).toBe("new");
  });

  test("não dá para virar admin no cadastro nem forçar status, dono ou ID de um orçamento", async () => {
    const api = await apiAs();
    const email = `intruso.${Date.now()}@teste.local`;
    const registered = await (await api.post("/api/auth/register", { data: { name: "Intruso", email, password: "senha-123456", role: "admin" } })).json();
    expect(registered.user.role).toBe("client");
    const victim = await createClient();
    const forged = await api.post("/api/quotes", { data: quoteBody({ status: "closed", userId: victim.id, id: "id-forjado", createdAt: "2000-01-01" }) });
    expect(forged.status()).toBe(201);
    const { quote } = await forged.json();
    expect(quote).toMatchObject({ status: "new", userId: registered.user.id });
    expect(quote.id).not.toBe("id-forjado");
    expect(quote.createdAt).not.toBe("2000-01-01");
    await api.dispose();
  });
});

test.describe("injeção de código", () => {
  const XSS = ['<script>alert("xss")</script>', '"><img src=x onerror=alert(1)>', "<svg onload=alert(1)>"];
  const SQL = ["' OR '1'='1", "'; DROP TABLE quotes; --", "Robert'); DROP TABLE users;--"];

  test("scripts nos campos não executam no painel admin nem na área do cliente e aparecem como texto", async ({ browser }) => {
    const client = await createClient({ name: XSS[1] });
    await createQuote(client, { name: XSS[1], eventType: XSS[0], menuPackage: XSS[2], message: XSS.join(" "), menuItems: [XSS[2]], phone: "(12) 99999-1111" });

    for (const [who, user, path] of [
      ["admin", TEST_ADMIN, /admin\.html/],
      ["cliente", client, /minha-conta/],
    ]) {
      const { context, page } = await personPage(browser);
      const dialogs = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
      await loginViaUi(page, user);
      await expect(page).toHaveURL(path);
      await page.waitForLoadState("networkidle");
      if (who === "admin") {
        await expect(page.locator(".admin-quote", { hasText: XSS[0] }).first()).toBeVisible();
        await page.locator('[aria-controls="admin-users-panel"]').click();
      } else {
        await expect(page.locator(".quote-card", { hasText: XSS[0] })).toBeVisible();
      }
      await expect(page.locator("main img[src='x']"), `nenhuma tag injetada virou elemento (${who})`).toHaveCount(0);
      await expect(page.locator("main svg[onload]")).toHaveCount(0);
      // O nome do cliente aparece no header ("Olá, ...") também.
      await page.waitForTimeout(500);
      expect(dialogs, `alertas executados na tela do ${who}`).toEqual([]);
      await context.close();
    }
  });

  test("textos de SQL injection não quebram o login nem o banco, e são salvos como texto", async () => {
    const api = await apiAs();
    for (const attempt of SQL) {
      const response = await api.post("/api/auth/login", { data: { email: attempt, password: attempt } });
      expect(response.status(), `login com ${attempt}`).toBe(401);
    }
    await api.dispose();
    const before = (await allQuotes()).length;
    const client = await createClient({ name: SQL[2] });
    const quote = await createQuote(client, { name: SQL[2], message: SQL.join(" | "), eventType: SQL[1] });
    const quotes = await allQuotes();
    expect(quotes.length).toBe(before + 1);
    expect(quotes.find((item) => item.id === quote.id)).toMatchObject({ name: SQL[2], message: SQL.join(" | "), eventType: SQL[1] });
    const admin = await adminApi();
    expect((await admin.get("/api/admin/users")).status(), "tabela de usuários continua lá").toBe(200);
    await admin.dispose();
  });

  test("JSON malformado, corpo grande demais e senha enorme recebem erro claro (4xx), não erro interno", async () => {
    const api = await apiAs();
    const malformed = await api.post("/api/auth/login", { headers: { "Content-Type": "application/json" }, data: "{ isso não é json" });
    expect(malformed.status(), "JSON malformado").toBe(400);
    const huge = await api.post("/api/auth/register", { data: { name: "x", email: "grande@teste.local", password: "a".repeat(30_000) } });
    expect(huge.status(), "corpo acima de 20kb").toBe(413);
    const longPassword = await api.post("/api/auth/register", { data: { name: "x", email: `longa.${Date.now()}@teste.local`, password: "a".repeat(129) } });
    expect(longPassword.status(), "senha com 129 caracteres").toBe(400);
    await api.dispose();
  });

  test("muitas tentativas de login seguidas são bloqueadas (força bruta)", async () => {
    const api = await apiAs();
    const statuses = [];
    for (let attempt = 0; attempt < 12; attempt++)
      statuses.push((await api.post("/api/auth/login", { data: { email: TEST_ADMIN.email, password: `chute-${attempt}` } })).status());
    await api.dispose();
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

test.describe("senhas e segredos", () => {
  test("nenhuma resposta da API devolve senha ou hash de senha", async () => {
    const password = "senha-que-nao-pode-vazar-123";
    const api = await apiAs();
    const email = `vazamento.${Date.now()}@teste.local`;
    const bodies = [];
    bodies.push(await (await api.post("/api/auth/register", { data: { name: "Vazamento", email, password } })).text());
    bodies.push(await (await api.post("/api/auth/login", { data: { email, password } })).text());
    bodies.push(await (await api.get("/api/auth/me")).text());
    bodies.push(await (await api.get("/api/my/quotes")).text());
    await api.dispose();
    const admin = await adminApi();
    bodies.push(await (await admin.get("/api/admin/users")).text());
    bodies.push(await (await admin.get("/api/admin/export/users.csv")).text());
    bodies.push(await (await admin.get("/api/quotes")).text());
    await admin.dispose();
    for (const body of bodies) {
      expect(body).not.toContain(password);
      expect(body).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
  });

  test("senhas não aparecem no log do servidor nem ficam guardadas no navegador", async ({ browser }) => {
    const client = await createClient({ password: "senha-do-navegador-456" });
    const { context, page } = await personPage(browser);
    await loginViaUi(page, client);
    await expect(page).toHaveURL(/minha-conta/);
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
    expect(storage).not.toContain(client.password);
    expect(storage).not.toMatch(/eyJ[\w-]+\.[\w-]+\./); // nenhum token de sessão acessível ao JavaScript
    await context.close();
    const log = existsSync(SERVER_LOG) ? readFileSync(SERVER_LOG, "utf8") : "";
    for (const secret of [client.password, TEST_ADMIN.password]) expect(log).not.toContain(secret);
  });

  test("os arquivos do site publicado (dist) não contêm segredos do servidor", async () => {
    const files = [];
    const walk = (dir) => readdirSync(dir).forEach((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : files.push(join(dir, name))));
    walk(join(ROOT, "dist"));
    const texts = files.filter((file) => /\.(js|css|html|json|map)$/.test(file)).map((file) => [file, readFileSync(file, "utf8")]);
    const envValues = existsSync(join(ROOT, ".env"))
      ? readFileSync(join(ROOT, ".env"), "utf8")
          .split(/\r?\n/)
          .map((line) => /^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/.exec(line))
          .filter((match) => match && /SECRET|PASSWORD|PASS|KEY|TOKEN/.test(match[1]) && match[2].length >= 6)
      : [];
    const leaks = [];
    for (const [file, text] of texts) {
      for (const word of ["JWT_SECRET", "ADMIN_PASSWORD", "SMTP_PASS", "passwordHash", "development-secret-change-me", "AKIA"])
        if (text.includes(word)) leaks.push(`${word} em ${file}`);
      // Os valores do .env são comparados sem nunca serem mostrados.
      for (const [, key, value] of envValues) if (text.includes(value)) leaks.push(`valor de ${key} em ${file}`);
    }
    expect(leaks).toEqual([]);
  });

  test("o repositório não tem .env, banco de dados nem chaves commitados (inclusive no histórico)", async () => {
    const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const tracked = git("ls-files").split("\n").filter(Boolean);
    expect(tracked.filter((file) => /(^|\/)\.env($|\.)(?!example)|\.db$|\.sqlite$|^data\//.test(file)), "arquivos sensíveis versionados").toEqual([]);
    const everCommitted = git("log", "--all", "--format=", "--name-only").split("\n").filter(Boolean);
    expect([...new Set(everCommitted.filter((file) => /(^|\/)\.env$|\.db$|^data\//.test(file)))], "arquivos sensíveis no histórico").toEqual([]);
    const patterns = /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[bp]-[\w-]{10,}|ghp_[\w]{30,}/;
    const leaks = tracked.filter((file) => existsSync(join(ROOT, file)) && !/\.(png|jpe?g|mp4|webp|ico|lock)$/i.test(file) && patterns.test(readFileSync(join(ROOT, file), "utf8")));
    expect(leaks, "arquivos com cara de chave/token").toEqual([]);
  });
});
