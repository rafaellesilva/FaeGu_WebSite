import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const headerFile = resolve(import.meta.dirname, "partials/header.html");

// Header único do site: cada página tem <!-- site-header --> (ou <!-- site-header:voltar -->),
// trocado pelo conteúdo de partials/header.html com o botão da direita escolhido.
function siteHeader() {
  return {
    name: "site-header",
    // Em desenvolvimento, recarrega a página quando o header compartilhado muda.
    configureServer(server) {
      server.watcher.add(headerFile);
      server.watcher.on("change", (file) => {
        if (resolve(file) === headerFile) server.ws.send({ type: "full-reload" });
      });
    },
    transformIndexHtml(html) {
      return html.replace(/<!--\s*site-header(?::(\w+))?\s*-->/, (_, cta = "contato") => {
        const header = readFileSync(headerFile, "utf8");
        return header
          .replace(/[ \t]*<!-- cta:(\w+) -->\r?\n([\s\S]*?)[ \t]*<!-- \/cta -->\r?\n/g, (__, name, button) => (name === cta ? button : ""))
          .trim();
      });
    },
  };
}

export default defineConfig({
  plugins: [siteHeader()],
  // Em desenvolvimento, /api vai para o servidor Express (npm start), igual em produção.
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        sobre: resolve(import.meta.dirname, "pages/sobre-a-fa-e-gu.html"),
        servicos: resolve(import.meta.dirname, "pages/servicos-para-eventos.html"),
        portfolio: resolve(import.meta.dirname, "pages/portfolio-de-eventos.html"),
        contato: resolve(import.meta.dirname, "pages/contato-e-orcamento.html"),
        acesso: resolve(import.meta.dirname, "pages/acesso.html"),
        conta: resolve(import.meta.dirname, "pages/minha-conta.html"),
        admin: resolve(import.meta.dirname, "pages/admin.html"),
      },
    },
  },
});
