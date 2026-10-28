import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
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
