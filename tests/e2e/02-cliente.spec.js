// 2. FLUXO DO CLIENTE: cadastro, login, logout, envio de orçamento, validações, duplo clique e sessão.
import { expect, test } from "@playwright/test";
import { BASE_URL, TEST_ADMIN } from "./config.js";
import { allQuotes, apiAs, createClient, futureDate, loginViaUi, openTab, personPage, quoteBody, scrollThrough, uniqueEmail, useOwnIp } from "./helpers.js";

// Abre o simulador já logado e espera a página reconhecer a sessão.
// Rola a página como uma pessoa faria: as seções só aparecem (animação de entrada) quando chegam na tela.
async function openSimulator(page) {
  await page.goto("/pages/servicos-para-eventos.html#simulador");
  await scrollThrough(page);
  await expect(page.locator("#budget-submit")).toContainText("Enviar minha simulação");
}

async function fillSimulator(page, { eventType = "Festa infantil", date = futureDate(), guests = "80", phone = "(12) 98888-7777" } = {}) {
  const form = page.locator("#budget-form");
  await form.locator('select[name="eventType"]').selectOption(eventType);
  await form.locator('input[name="eventDate"]').fill(date);
  await form.locator('input[name="guests"]').fill(guests);
  // As opções são cartões clicáveis (o rádio/checkbox fica escondido dentro do rótulo): clica no cartão, como uma pessoa.
  await form.locator('.menu-option:not([hidden]):has(input[name="menuPackage"])').first().click();
  const addon = form.locator('.menu-option:not([hidden]):has(input[name="addons"])').first();
  await addon.click();
  await expect(addon.locator("input")).toBeChecked();
  await form.locator('input[name="phone"]').fill(phone);
}

test.describe("cadastro, login e logout", () => {
  test("cria conta pela tela de acesso, sai e entra de novo", async ({ browser }) => {
    const { context, page } = await personPage(browser);
    const user = { name: "Maria Cadastro", email: uniqueEmail("cadastro"), password: "senha-forte-123" };
    await openTab(page, "/pages/acesso.html");
    await page.locator("#auth-switch").click();
    await page.locator('#auth-form input[name="name"]').fill(user.name);
    await page.locator('#auth-form input[name="email"]').fill(user.email);
    await page.locator('#auth-form input[name="password"]').fill(user.password);
    await page.locator("#auth-submit").click();
    await expect(page).toHaveURL(/minha-conta/);
    await expect(page.locator("#account-page-name")).toHaveText(user.name);
    await expect(page.locator(".main-nav [data-account-link]")).toHaveText("Olá, Maria");

    await page.locator("#account-page-logout").click();
    await expect(page).toHaveURL(/acesso/);
    await page.goto("/pages/minha-conta.html");
    await expect(page, "depois de sair, a área do cliente pede login").toHaveURL(/acesso/);

    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    await context.close();
  });

  test("mostra erro para e-mail inválido, senha curta, senha errada e e-mail já cadastrado", async ({ browser }) => {
    const existing = await createClient();
    const { context, page } = await personPage(browser);
    await openTab(page, "/pages/acesso.html");
    const feedback = page.locator("#auth-feedback");
    const email = page.locator('#auth-form input[name="email"]');
    const password = page.locator('#auth-form input[name="password"]');

    await email.fill("nao-e-email");
    await password.fill("12345678");
    await page.locator("#auth-submit").click();
    await expect(feedback).toHaveText("Informe um e-mail válido.");

    await email.fill(existing.email);
    await password.fill("123");
    await page.locator("#auth-submit").click();
    await expect(feedback).toHaveText("A senha deve ter pelo menos 8 caracteres.");

    await password.fill("senha-errada-123");
    await page.locator("#auth-submit").click();
    await expect(feedback).toHaveText("E-mail ou senha inválidos.");

    await page.locator("#auth-switch").click();
    await page.locator('#auth-form input[name="name"]').fill("Outra Pessoa");
    await password.fill("senha-qualquer-123");
    await page.locator("#auth-submit").click();
    await expect(feedback).toHaveText("Este e-mail já está cadastrado.");
    await context.close();
  });
});

test("envia um orçamento completo e ele aparece no painel admin como Novo, com todos os campos", async ({ browser }) => {
  const user = await createClient({ name: `Cliente Completo ${Date.now()}` });
  const { context, page } = await personPage(browser);
  await loginViaUi(page, user);
  await expect(page).toHaveURL(/minha-conta/);
  await openSimulator(page);
  const date = futureDate(200);
  await fillSimulator(page, { eventType: "Festa infantil", date, guests: "85", phone: "(12) 98888-7777" });
  await page.locator("#budget-submit").click();
  await expect(page.locator("#budget-feedback")).toHaveText("Recebemos sua simulação. Em breve a gente entra em contato.");

  const quote = (await allQuotes()).find((item) => item.userId === user.id);
  expect(quote, "orçamento salvo").toBeTruthy();
  expect(quote).toMatchObject({ status: "new", name: user.name, email: user.email, phone: "(12) 98888-7777", eventType: "Festa infantil", eventDate: date, guests: 85 });
  expect(quote.menuPackage).not.toBe("");
  expect(quote.menuItems.length).toBe(1);

  // Painel admin, em outra "pessoa".
  const admin = await personPage(browser);
  await loginViaUi(admin.page, TEST_ADMIN);
  await expect(admin.page).toHaveURL(/admin/);
  const card = admin.page.locator(".admin-quote", { hasText: user.name });
  await expect(card).toBeVisible();
  await expect(card.locator("select")).toHaveValue("new");
  for (const text of ["(12) 98888-7777", user.email, "Festa infantil", "85", quote.menuPackage]) await expect(card).toContainText(text);
  await admin.context.close();
  await context.close();
});

test.describe("validações do orçamento", () => {
  let user;
  test.beforeAll(async () => {
    user = await createClient({ name: "Cliente Validações" });
  });

  test("formulário: campos obrigatórios vazios não enviam nada", async ({ browser }) => {
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    await openSimulator(page);
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/quotes")) posts++;
    });
    await page.locator('#budget-form input[name="name"]').fill("");
    await page.locator('#budget-form input[name="eventDate"]').fill("");
    await page.locator("#budget-submit").click();
    await page.waitForTimeout(500);
    expect(await page.locator("#budget-form").evaluate((form) => form.checkValidity())).toBe(false);
    expect(posts, "nenhum envio com campos vazios").toBe(0);
    await context.close();
  });

  test("formulário: telefone ausente, inválido e e-mail inválido são barrados", async ({ browser }) => {
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    await openSimulator(page);
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/quotes")) posts++;
    });
    await fillSimulator(page, { phone: "" });
    await page.locator("#budget-submit").click();
    expect(await page.locator('#budget-form input[name="phone"]').evaluate((input) => input.validity.valueMissing)).toBe(true);

    await page.locator('#budget-form input[name="phone"]').fill("123");
    await page.locator("#budget-submit").click();
    await expect(page.locator("#budget-feedback")).toHaveText("Informe um telefone válido com DDD.");

    await page.locator('#budget-form input[name="phone"]').fill("(12) 98888-7777");
    await page.locator('#budget-form input[name="email"]').fill("email-invalido");
    await page.locator("#budget-submit").click();
    expect(await page.locator('#budget-form input[name="email"]').evaluate((input) => input.validity.typeMismatch)).toBe(true);
    expect(posts, "nada foi enviado").toBe(0);
    await context.close();
  });

  test("formulário: data no passado é recusada", async ({ browser }) => {
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    await openSimulator(page);
    await fillSimulator(page, { date: "2020-01-15" });
    const sent = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/quotes"), { timeout: 3000 }).then(() => true).catch(() => false);
    await page.locator("#budget-submit").click();
    expect(await sent, "o site aceitou um evento em 2020").toBe(false);
    await context.close();
  });

  test("API: telefone, e-mail, data, convidados e tamanhos inválidos retornam 400", async () => {
    const api = await apiAs(user);
    const cases = {
      "telefone ausente": { phone: "" },
      "telefone com letras": { phone: "abcdefghijk" },
      "e-mail inválido": { email: "fulano@" },
      "mensagem vazia": { message: "" },
      "data no passado": { eventDate: "2020-01-15" },
      "data inexistente (31/02)": { eventDate: "2026-02-31" },
      "data em texto qualquer": { eventDate: "amanhã de manhã" },
      "convidados zero": { guests: 0 },
      "convidados negativo": { guests: -5 },
      "convidados demais": { guests: 50_000 },
      "nome com 121 caracteres": { name: "a".repeat(121) },
      "mensagem com 4001 caracteres": { message: "a".repeat(4001) },
      "tipo de evento com 500 caracteres": { eventType: "a".repeat(500) },
    };
    const accepted = [];
    for (const [label, overrides] of Object.entries(cases)) {
      const response = await api.post("/api/quotes", { data: quoteBody(overrides) });
      if (response.status() !== 400) accepted.push(`${label} -> ${response.status()}`);
    }
    await api.dispose();
    expect(accepted, "entradas inválidas que o servidor aceitou").toEqual([]);
  });

  test("formulário: nome muito longo mostra uma mensagem que explica o problema", async ({ browser }) => {
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    await openSimulator(page);
    await fillSimulator(page);
    await page.locator('#budget-form input[name="name"]').fill("Nome ".repeat(40));
    await page.locator("#budget-submit").click();
    await expect(page.locator("#budget-feedback")).toHaveClass(/is-error/);
    await expect(page.locator("#budget-feedback"), "mensagem deveria falar do limite, não pedir para tentar de novo").not.toContainText("Tente novamente");
    await context.close();
  });

  test("acentos, caracteres especiais e emojis são salvos e devolvidos sem alteração", async () => {
    const special = {
      name: "José D'Ávila Ñúñez 🎉",
      eventType: "Aniversário de 15 anos ✨",
      menuPackage: "Coquetel Ouro & Cia <especial>",
      message: 'Quero "tudo" bem doce; maçã, pão-de-ló e açaí 🍰💐 — obrigado!',
      menuItems: ["Barraca de açaí", "Algodão-doce 🍭"],
    };
    const api = await apiAs(user);
    const response = await api.post("/api/quotes", { data: quoteBody(special) });
    expect(response.status()).toBe(201);
    const { quote } = await response.json();
    await api.dispose();
    const saved = (await allQuotes()).find((item) => item.id === quote.id);
    expect(saved).toMatchObject(special);
  });
});

test("duplo clique em enviar não cria orçamento duplicado", async ({ browser }) => {
  const user = await createClient({ name: "Cliente Duplo Clique" });
  const { context, page } = await personPage(browser);
  await loginViaUi(page, user);
  await expect(page).toHaveURL(/minha-conta/);
  await openSimulator(page);
  await fillSimulator(page);
  await page.locator("#budget-submit").dblclick();
  await expect(page.locator("#budget-feedback")).toContainText("Recebemos");
  await page.waitForTimeout(1000);
  const mine = (await allQuotes()).filter((quote) => quote.userId === user.id);
  expect(mine.length, "orçamentos criados com um duplo clique").toBe(1);
  await context.close();
});

test.describe("sessão do cliente", () => {
  test("o login usa cookie de sessão (sem data de expiração) e protegido do JavaScript", async ({ browser }) => {
    const user = await createClient();
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    const cookie = (await context.cookies()).find((item) => item.name === "fa_gu_session");
    expect(cookie, "cookie de sessão").toBeTruthy();
    expect(cookie.expires, "-1 = apaga ao fechar o navegador").toBe(-1);
    expect(cookie.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("fa_gu_session");
    await context.close();
  });

  test("fechar e reabrir o navegador (mesmo com o cookie restaurado) pede login de novo", async ({ browser }) => {
    const user = await createClient();
    const first = await personPage(browser);
    await loginViaUi(first.page, user);
    await expect(first.page).toHaveURL(/minha-conta/);
    // Alguns navegadores restauram cookies de sessão ao reabrir; simula o pior caso.
    const state = await first.context.storageState();
    await first.context.close();

    const reopened = await useOwnIp(await browser.newContext({ storageState: state }));
    const page = await reopened.newPage();
    await page.goto("/pages/minha-conta.html");
    await expect(page).toHaveURL(/acesso/);
    await reopened.close();
  });

  test("abrir o site numa nova aba, com outra aba logada, não derruba o login", async ({ browser }) => {
    const user = await createClient();
    const { context, page } = await personPage(browser);
    await loginViaUi(page, user);
    await expect(page).toHaveURL(/minha-conta/);
    const secondTab = await context.newPage();
    await secondTab.goto("/pages/servicos-para-eventos.html");
    await secondTab.waitForLoadState("networkidle");
    await page.reload();
    await expect(page, "a primeira aba continua logada").toHaveURL(/minha-conta/);
    await context.close();
  });
});

test("visitante sem login que tenta enviar a simulação é levado ao login e volta para o simulador", async ({ browser }) => {
  const { context, page } = await personPage(browser);
  await openTab(page, "/pages/servicos-para-eventos.html#simulador");
  await scrollThrough(page);
  await expect(page.locator("#budget-submit")).toContainText("Entrar para enviar");
  await page.locator("#budget-submit").click();
  await expect(page).toHaveURL(`${BASE_URL}/pages/acesso.html?next=${encodeURIComponent("/pages/servicos-para-eventos.html#simulador")}`);
  const user = await createClient();
  await page.locator('#auth-form input[name="email"]').fill(user.email);
  await page.locator('#auth-form input[name="password"]').fill(user.password);
  await page.locator("#auth-submit").click();
  await expect(page).toHaveURL(/servicos-para-eventos\.html#simulador/);
  await context.close();
});
