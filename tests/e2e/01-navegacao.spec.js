// 1. NAVEGAÇÃO GERAL: páginas, links, imagens, header, "anos de experiência" e layout em várias larguras.
import { expect, test } from "@playwright/test";
import { BASE_URL } from "./config.js";
import { PAGES, personPage, scrollThrough, watchErrors } from "./helpers.js";

for (const { name, path } of PAGES) {
  test(`${name}: carrega sem erros de console, sem requisições com falha e sem imagens faltando`, async ({ browser }) => {
    const { context, page } = await personPage(browser);
    const errors = watchErrors(page);
    const response = await page.goto(path);
    expect(response.status(), "status HTTP da página").toBe(200);
    await expect(page).toHaveTitle(/Fa & Gu/);
    await scrollThrough(page);

    const brokenImages = await page.evaluate(() =>
      [...document.images].filter((image) => image.getAttribute("src") && (!image.complete || image.naturalWidth === 0)).map((image) => image.src),
    );
    // "soft": mostra todos os problemas da página de uma vez, em vez de parar no primeiro.
    expect.soft(brokenImages, "imagens que não carregaram").toEqual([]);
    expect.soft(errors.exceptions, "erros de JavaScript na página").toEqual([]);
    expect.soft(errors.console, "erros no console").toEqual([]);
    expect.soft(errors.failed, "requisições do próprio site com falha").toEqual([]);
    if (errors.external.length) test.info().annotations.push({ type: "externos com falha", description: errors.external.join("\n") });
    await context.close();
  });
}

test('existe uma página "Feedbacks" (depoimentos) acessível pelo menu ou rodapé', async ({ page }) => {
  await page.goto("/");
  const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => anchor.textContent.trim().toLowerCase()));
  expect(links.some((text) => /feedback|depoimento/.test(text)), "link para Feedbacks/Depoimentos").toBe(true);
});

test("depoimentos (feedbacks) aparecem na Início e o carrossel do Portfólio troca ao clicar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".testimonial-grid article")).not.toHaveCount(0);
  await page.goto("/pages/portfolio-de-eventos.html");
  await scrollThrough(page);
  const active = page.locator(".testimonial-slide.is-active strong");
  const first = await active.textContent();
  await page.locator(".testimonial-next").click();
  await expect(active).not.toHaveText(first);
});

test("todos os links internos abrem (sem 404) e as âncoras existem; links externos são válidos", async ({ page, request }) => {
  const internal = new Set();
  const external = new Set();
  for (const { path } of PAGES) {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.href));
    for (const href of hrefs) (href.startsWith(BASE_URL) ? internal : external).add(href);
  }
  const broken = [];
  for (const href of internal) {
    const [url, hash] = href.split("#");
    const response = await request.get(url);
    if (response.status() !== 200) {
      broken.push(`${response.status()} ${href}`);
      continue;
    }
    if (hash) {
      await page.goto(url);
      if (!(await page.locator(`[id="${hash}"]`).count())) broken.push(`âncora #${hash} não existe em ${url}`);
    }
  }
  expect(broken, "links internos quebrados").toEqual([]);
  const invalid = [...external].filter((href) => !/^(https:\/\/|mailto:|tel:)/.test(href));
  expect(invalid, "links externos sem https").toEqual([]);
});

test('"Voltar ao início" leva para a página inicial', async ({ page }) => {
  await page.goto("/pages/acesso.html");
  await page.locator(".site-header .header-cta", { hasText: "Voltar ao início" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test("o header é o mesmo em todas as páginas (logo, links, tamanho e fonte)", async ({ browser }) => {
  const { context, page } = await personPage(browser);
  const snapshots = [];
  for (const { name, path } of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    snapshots.push({
      name,
      ...(await page.locator(".site-header").evaluate((header) => ({
        brand: header.querySelector(".brand img")?.getAttribute("src"),
        links: [...header.querySelectorAll(".main-nav a")].map((link) => `${link.textContent.trim()} -> ${link.getAttribute("href")}`),
        height: Math.round(header.getBoundingClientRect().height),
        navFont: getComputedStyle(header.querySelector(".main-nav")).fontFamily + " " + getComputedStyle(header.querySelector(".main-nav")).fontSize,
        cta: header.querySelector(".header-cta")?.textContent.trim(),
      }))),
    });
  }
  const [reference] = snapshots;
  for (const snapshot of snapshots) {
    expect(snapshot.brand, `logo em ${snapshot.name}`).toBe(reference.brand);
    expect(snapshot.links, `links em ${snapshot.name}`).toEqual(reference.links);
    // 1px de folga: arredondamento de subpixel do navegador.
    expect(Math.abs(snapshot.height - reference.height), `altura do header em ${snapshot.name} (${snapshot.height} x ${reference.height})`).toBeLessThanOrEqual(1);
    expect(snapshot.navFont, `fonte do menu em ${snapshot.name}`).toBe(reference.navFont);
    // Por pedido, as páginas de conta mantêm "Voltar ao início" no lugar de "Vamos conversar".
    expect(["Vamos conversar ↗", "Voltar ao início ↗"], `botão do header em ${snapshot.name}`).toContain(snapshot.cta);
  }
  await context.close();
});

test('"anos de experiência" mostra o ano atual menos 2010, e é o único número', async ({ page }) => {
  await page.goto("/pages/sobre-a-fa-e-gu.html");
  const numbers = page.locator(".numbers-grid > div");
  await numbers.first().scrollIntoViewIfNeeded();
  await expect(numbers).toHaveCount(1);
  await expect(numbers.first().locator("span")).toHaveText("anos de experiência");
  await expect(numbers.first().locator("strong")).toHaveText(String(new Date().getFullYear() - 2010), { timeout: 8000 });
});

test("botões interativos funcionam sem erros (abas de cardápio, cards de serviço, FAQ, menu do celular)", async ({ browser }) => {
  const { context, page } = await personPage(browser);
  const errors = watchErrors(page);
  await page.goto("/pages/servicos-para-eventos.html");
  await scrollThrough(page);
  await page.locator('[data-menu-tab="infantil"]').click();
  await expect(page.locator("#cardapio-infantil")).toBeVisible();
  await expect(page.locator("#cardapio-corporativo")).toBeHidden();
  const card = page.locator(".event-card").nth(1);
  await card.locator(".event-card__top").click();
  await expect(card).toHaveClass(/is-open/);

  await page.goto("/pages/contato-e-orcamento.html");
  await scrollThrough(page);
  const faq = page.locator(".faq-list details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.locator(".main-nav")).toBeHidden();
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".main-nav")).toBeVisible();
  await page.locator(".main-nav a", { hasText: "Serviços" }).click();
  await expect(page).toHaveURL(/servicos-para-eventos/);
  expect(errors.exceptions).toEqual([]);
  await context.close();
});

test("portfólio: o mosaico tem todas as fotos e abre a foto em tela cheia com setas e Esc", async ({ page }) => {
  await page.goto("/pages/portfolio-de-eventos.html");
  await scrollThrough(page);
  const items = page.locator(".mosaic-item");
  await expect(items).toHaveCount(34);
  await items.nth(2).click();
  const viewer = page.locator(".viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".viewer-count")).toHaveText("03 / 34");
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".viewer-count")).toHaveText("04 / 34");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

for (const width of [375, 768, 1440]) {
  test(`largura ${width}px: nenhuma página com rolagem horizontal ou header sobreposto`, async ({ browser }) => {
    const { context, page } = await personPage(browser, { viewport: { width, height: 900 } });
    const problems = [];
    for (const { name, path } of PAGES) {
      await page.goto(path);
      await scrollThrough(page);
      const result = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        // Elementos que passam da borda direita da tela (ignora os escondidos e o que está dentro de áreas com rolagem própria).
        const offenders = [...document.querySelectorAll("body *")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || getComputedStyle(element).visibility === "hidden") return false;
            return rect.right > document.documentElement.clientWidth + 1;
          })
          .slice(0, 5)
          .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`);
        const visible = (element) => element && element.getBoundingClientRect().width > 0 && getComputedStyle(element).display !== "none";
        const header = document.querySelector(".site-header");
        const parts = [".brand", ".main-nav", ".header-cta", ".menu-toggle"].map((selector) => header.querySelector(selector)).filter(visible);
        const overlaps = [];
        for (let i = 0; i < parts.length; i++)
          for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i].getBoundingClientRect();
            const b = parts[j].getBoundingClientRect();
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
              overlaps.push(`${parts[i].className} x ${parts[j].className}`);
          }
        return { overflow, offenders, overlaps };
      });
      if (result.overflow > 1) problems.push(`${name}: rolagem horizontal de ${result.overflow}px (${result.offenders.join(", ")})`);
      if (result.overlaps.length) problems.push(`${name}: header sobreposto (${result.overlaps.join("; ")})`);
      await page.screenshot({ path: test.info().outputPath(`${width}px-${name}.png`), fullPage: true });
    }
    expect(problems).toEqual([]);
    await context.close();
  });
}
