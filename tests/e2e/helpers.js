// Funções compartilhadas pelos testes E2E.
import { request as playwrightRequest } from "@playwright/test";
import { BASE_URL, TEST_ADMIN } from "./config.js";

export const PAGES = [
  { name: "Início", path: "/" },
  { name: "Sobre nós", path: "/pages/sobre-a-fa-e-gu.html" },
  { name: "Serviços", path: "/pages/servicos-para-eventos.html" },
  { name: "Portfólio", path: "/pages/portfolio-de-eventos.html" },
  { name: "Contato", path: "/pages/contato-e-orcamento.html" },
  { name: "Acesso", path: "/pages/acesso.html" },
];

// O site limita tentativas de login/cadastro e de orçamentos por IP. Cada "pessoa" simulada usa um IP próprio
// (cabeçalho X-Forwarded-For, que o servidor aceita de um proxy), para os testes não esbarrarem no limite.
let ipCounter = 0;
export const nextIp = () => {
  ipCounter++;
  return `10.${process.pid % 250}.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
};

let emailCounter = 0;
export const uniqueEmail = (prefix = "cliente") => `${prefix}.${Date.now()}.${++emailCounter}@teste.local`;

export const futureDate = (days = 120) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Contexto de API isolado (cookies próprios), como um usuário ou atacante fazendo requisições direto.
export async function apiAs(user) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "X-Forwarded-For": nextIp() } });
  if (user) {
    const response = await api.post("/api/auth/login", { data: { email: user.email, password: user.password } });
    if (!response.ok()) throw new Error(`Login de teste falhou para ${user.email}: ${response.status()}`);
  }
  return api;
}

export async function createClient(overrides = {}) {
  const user = { name: "Cliente Teste", email: uniqueEmail(), password: "senha-cliente-123", ...overrides };
  const api = await apiAs();
  const response = await api.post("/api/auth/register", { data: user });
  if (response.status() !== 201) throw new Error(`Cadastro de teste falhou: ${response.status()} ${await response.text()}`);
  user.id = (await response.json()).user.id;
  await api.dispose();
  return user;
}

export const adminApi = () => apiAs(TEST_ADMIN);

export function quoteBody(overrides = {}) {
  return {
    name: "Cliente Teste",
    email: "cliente@teste.local",
    phone: "(12) 99999-0000",
    eventType: "Casamento",
    eventDate: futureDate(),
    guests: 120,
    menuPackage: "Casamento Ouro",
    menuItems: ["Decoração"],
    message: "Simulação de teste.",
    ...overrides,
  };
}

export async function createQuote(user, overrides = {}) {
  const api = await apiAs(user);
  const response = await api.post("/api/quotes", { data: quoteBody({ name: user.name, email: user.email, ...overrides }) });
  if (response.status() !== 201) throw new Error(`Orçamento de teste falhou: ${response.status()} ${await response.text()}`);
  const { quote } = await response.json();
  await api.dispose();
  return quote;
}

export async function allQuotes() {
  const api = await adminApi();
  const { quotes } = await (await api.get("/api/quotes")).json();
  await api.dispose();
  return quotes;
}

// Dá um IP próprio ao navegador, só nas requisições para o próprio site
// (serviços externos, como o Google Fonts, recusam esse cabeçalho e bloqueariam as fontes).
export async function useOwnIp(context) {
  const ip = nextIp();
  await context.route(`${BASE_URL}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }));
  return context;
}

// Página de navegador para uma "pessoa": IP próprio e sem nada salvo de outras sessões.
export async function personPage(browser, options = {}) {
  const context = await useOwnIp(await browser.newContext(options));
  const page = await context.newPage();
  return { context, page };
}

// A primeira página de cada aba nova encerra a sessão anterior (sessionStorage). Espera isso terminar antes de logar.
export async function openTab(page, path = "/") {
  const logout = page.waitForResponse((response) => response.url().endsWith("/api/auth/logout"), { timeout: 10_000 }).catch(() => null);
  await page.goto(path);
  await logout;
}

// Login pela tela de acesso, como uma pessoa faria.
export async function loginViaUi(page, user) {
  await openTab(page, "/pages/acesso.html");
  await page.locator('#auth-form input[name="email"]').fill(user.email);
  await page.locator('#auth-form input[name="password"]').fill(user.password);
  await page.locator("#auth-submit").click();
}

// Registra erros de console, exceções da página e requisições com falha. Recursos externos (fontes, mapas) ficam à parte.
export function watchErrors(page) {
  const report = { console: [], exceptions: [], failed: [], external: [] };
  const sameOrigin = (url) => url.startsWith(BASE_URL);
  page.on("console", (message) => {
    if (message.type() === "error") report.console.push(message.text());
  });
  page.on("pageerror", (error) => report.exceptions.push(String(error)));
  page.on("requestfailed", (request) => {
    const entry = `${request.method()} ${request.url()} (${request.failure()?.errorText})`;
    // Requisições canceladas pelo próprio navegador ao trocar de página não são falhas do site.
    if (request.failure()?.errorText?.includes("ERR_ABORTED")) return;
    (sameOrigin(request.url()) ? report.failed : report.external).push(entry);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    // 401 em /api/auth/me é o "não logado" esperado para visitantes.
    if (response.url().endsWith("/api/auth/me") && response.status() === 401) return;
    const entry = `${response.status()} ${response.url()}`;
    (sameOrigin(response.url()) ? report.failed : report.external).push(entry);
  });
  return report;
}

// Rola a página até o fim, devagar, para disparar fotos com carregamento sob demanda e animações de entrada.
export async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(window.innerHeight * 0.7)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

// CSV do painel: BOM + separador ";" + campos entre aspas.
export function parseCsv(text) {
  const hasBom = text.charCodeAt(0) === 0xfeff;
  const body = hasBom ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quoted) {
      if (char === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ";") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || (char === "\r" && body[i + 1] === "\n")) {
      if (char === "\r") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [header, ...data] = rows;
  return { hasBom, header, rows: data.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]]))) };
}
