// 3. FLUXO DO ADMIN: login, status, filtro, exportações, exclusão de cliente e sessão.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { TEST_ADMIN } from "./config.js";
import { adminApi, allQuotes, apiAs, createClient, createQuote, loginViaUi, parseCsv, personPage, useOwnIp } from "./helpers.js";

async function openAdmin(browser) {
  const person = await personPage(browser);
  await loginViaUi(person.page, TEST_ADMIN);
  await expect(person.page).toHaveURL(/admin\.html/);
  await expect(person.page.locator("#admin-quote-list .admin-empty", { hasText: "Carregando" })).toHaveCount(0);
  return person;
}

test("senha errada não entra; senha certa abre o painel", async ({ browser }) => {
  const { context, page } = await personPage(browser);
  await loginViaUi(page, { email: TEST_ADMIN.email, password: "senha-errada-999" });
  await expect(page.locator("#auth-feedback")).toHaveText("E-mail ou senha inválidos.");
  await expect(page).toHaveURL(/acesso/);
  await page.locator('#auth-form input[name="password"]').fill(TEST_ADMIN.password);
  await page.locator("#auth-submit").click();
  await expect(page).toHaveURL(/admin\.html/);
  await expect(page.locator("h1")).toHaveText("Pedidos de orçamento.");
  await context.close();
});

test("status Novo → Em contato → Agendado → Encerrado persiste depois de recarregar", async ({ browser }) => {
  const client = await createClient({ name: `Cliente Status ${Date.now()}` });
  await createQuote(client);
  const { context, page } = await openAdmin(browser);
  const card = page.locator(".admin-quote", { hasText: client.name });
  await expect(card.locator("select")).toHaveValue("new");
  for (const status of ["contacted", "scheduled", "closed"]) {
    const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok());
    await card.locator("select").selectOption(status);
    await saved;
    await page.reload();
    await expect(card.locator("select"), `status ${status} depois de recarregar`).toHaveValue(status);
  }
  await context.close();
});

test("filtro por status mostra só os orçamentos daquele status", async ({ browser }) => {
  const client = await createClient({ name: `Cliente Filtro ${Date.now()}` });
  const scheduled = await createQuote(client, { eventType: "Filtro Agendado" });
  await createQuote(client, { eventType: "Filtro Novo" });
  const api = await adminApi();
  await api.patch(`/api/quotes/${scheduled.id}`, { data: { status: "scheduled" } });
  await api.dispose();

  const { context, page } = await openAdmin(browser);
  for (const status of ["new", "contacted", "scheduled", "closed"]) {
    await page.locator("#admin-status-filter").selectOption(status);
    const statuses = await page.locator(".admin-quote:visible").evaluateAll((items) => items.map((item) => item.dataset.status));
    expect(new Set(statuses).size <= 1 && (statuses[0] ?? status) === status, `filtro ${status}: ${statuses}`).toBe(true);
  }
  await page.locator("#admin-status-filter").selectOption("scheduled");
  await expect(page.locator(".admin-quote:visible", { hasText: "Filtro Agendado" })).toHaveCount(1);
  await expect(page.locator(".admin-quote:visible", { hasText: "Filtro Novo" })).toHaveCount(0);
  await page.locator("#admin-status-filter").selectOption("");
  expect(await page.locator(".admin-quote:visible").count()).toBe((await allQuotes()).length);
  await context.close();
});

test.describe("exportação CSV", () => {
  let client;
  let quote;
  test.beforeAll(async () => {
    client = await createClient({ name: "Conceição Ávila Ñúñez" });
    quote = await createQuote(client, {
      phone: "(12) 97777-1234",
      eventType: "Aniversário de 15 anos",
      menuPackage: "Coquetel Ouro",
      menuItems: ["Barraca de açaí", "Algodão-doce"],
      message: 'Mensagem com "aspas"; ponto e vírgula e acentuação: maçã, pão, coração 💐',
      guests: 150,
    });
  });

  test("exportar um orçamento: o arquivo tem só ele, completo e com acentos", async ({ browser }) => {
    const { context, page } = await openAdmin(browser);
    const card = page.locator(".admin-quote", { hasText: client.name });
    const download = page.waitForEvent("download");
    await card.locator(".admin-quote-export").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^orcamento-conceicao-avila-nunez-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = parseCsv(readFileSync(await file.path(), "utf8"));
    expect(csv.hasBom, "BOM para o Excel reconhecer UTF-8").toBe(true);
    expect(csv.rows).toHaveLength(1);
    expect(csv.rows[0]).toMatchObject({
      Nome: client.name,
      "E-mail": client.email,
      Telefone: "(12) 97777-1234",
      "Tipo de evento": "Aniversário de 15 anos",
      "Data do evento": quote.eventDate,
      Convidados: "150",
      Pacote: "Coquetel Ouro",
      Adicionais: "Barraca de açaí, Algodão-doce",
      Mensagem: quote.message,
      Status: "new",
      ID: quote.id,
      "ID do cliente": client.id,
    });
    await context.close();
  });

  test("exportar todos: um orçamento por linha, mesmas colunas, nenhum faltando", async ({ browser }) => {
    const { context, page } = await openAdmin(browser);
    const download = page.waitForEvent("download");
    await page.locator('[data-admin-download="/api/admin/export/quotes.csv"]').click();
    const csv = parseCsv(readFileSync(await (await download).path(), "utf8"));
    const quotes = await allQuotes();
    expect(csv.rows).toHaveLength(quotes.length);
    expect(new Set(csv.rows.map((row) => row.ID))).toEqual(new Set(quotes.map((item) => item.id)));
    expect(csv.rows.find((row) => row.ID === quote.id)).toMatchObject({ Nome: client.name, Mensagem: quote.message });
    await context.close();
  });

  test("o status no CSV aparece em português (como no painel)", async () => {
    const api = await adminApi();
    const csv = parseCsv(await (await api.get(`/api/admin/export/quotes/${quote.id}.csv`)).text());
    await api.dispose();
    expect(["Novo", "Em contato", "Agendado", "Encerrado"]).toContain(csv.rows[0].Status);
  });
});

test("excluir cliente pede confirmação, remove a conta e mantém os orçamentos", async ({ browser }) => {
  const client = await createClient({ name: `Cliente Excluir ${Date.now()}` });
  const quote = await createQuote(client, { eventType: "Pedido que deve ficar" });
  const { context, page } = await openAdmin(browser);
  await page.locator('[aria-controls="admin-users-panel"]').click();
  const row = page.locator(".admin-user", { hasText: client.email });
  await expect(row).toBeVisible();

  // Cancelar não exclui.
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain(client.name);
    await dialog.dismiss();
  });
  await row.locator(".admin-user-delete").click();
  await page.waitForTimeout(500);
  await expect(row).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  const deleted = page.waitForResponse((response) => response.request().method() === "DELETE");
  await row.locator(".admin-user-delete").click();
  expect((await deleted).status()).toBe(204);
  await expect(row).toHaveCount(0);

  await page.reload();
  await page.locator('[aria-controls="admin-users-panel"]').click();
  await expect(page.locator(".admin-user", { hasText: client.email })).toHaveCount(0);
  const kept = (await allQuotes()).find((item) => item.id === quote.id);
  expect(kept, "orçamento continua no sistema").toMatchObject({ name: client.name, email: client.email, eventType: "Pedido que deve ficar", phone: quote.phone });

  // A conta não entra mais.
  const login = await apiAs();
  expect((await login.post("/api/auth/login", { data: { email: client.email, password: client.password } })).status()).toBe(401);
  await login.dispose();
  await context.close();
});

test("contas de administrador não têm botão de excluir e a API recusa excluir admin", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await page.locator('[aria-controls="admin-users-panel"]').click();
  await expect(page.locator(".admin-user", { hasText: TEST_ADMIN.email }).locator(".admin-user-delete")).toHaveCount(0);
  const api = await adminApi();
  const { users } = await (await api.get("/api/admin/users")).json();
  const admin = users.find((user) => user.email === TEST_ADMIN.email);
  expect((await api.delete(`/api/admin/users/${admin.id}`)).status()).toBe(400);
  await api.dispose();
  await context.close();
});

test("sessão do admin: reabrir o navegador pede login de novo", async ({ browser }) => {
  const { context } = await openAdmin(browser);
  const cookie = (await context.cookies()).find((item) => item.name === "fa_gu_session");
  expect(cookie.expires).toBe(-1);
  const state = await context.storageState();
  await context.close();
  const reopened = await useOwnIp(await browser.newContext({ storageState: state }));
  const again = await reopened.newPage();
  await again.goto("/pages/admin.html");
  await expect(again).toHaveURL(/acesso/);
  await reopened.close();
});
