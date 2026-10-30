import "./styles/style.css";
import "./styles/pages.css";
import heroVideo from "./assets/video/12759458_1920_1080_25fps.mp4";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
// Vazio = mesma origem do site (produção, e em desenvolvimento via proxy do Vite).
const apiBaseUrl = import.meta.env.VITE_API_URL || "";

// A sessão vale só enquanto a aba estiver aberta: a primeira página de uma aba nova encerra o login anterior.
const sessionReady = (() => {
  try {
    if (sessionStorage.getItem("fa_gu_tab")) return Promise.resolve();
    sessionStorage.setItem("fa_gu_tab", "1");
  } catch {
    return Promise.resolve();
  }
  return fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
})();
const fetchSession = async () => {
  await sessionReady;
  return fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
};

const statusLabels ={ new: "Novo", contacted: "Em contato", scheduled: "Agendado", closed: "Encerrado" };
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : "");

const projects = [
  { type: "Casamento", title: "Um sim para sempre" },
  { type: "15 anos", title: "Uma noite para lembrar" },
  { type: "Corporativo", title: "Ideias que conectam" },
];

// Avaliações reais do Google (fotos recortadas do perfil de cada pessoa).
const testimonials = [
  {
    text: "Fiz a festa de 3 anos da minha filha com eles, ficou tudo lindo e gostoso os salgadinhos foi elogiado por todos que foram a festa, atendimento excelente a erika muito simpática atendeu a todos muito bem. Recomendo",
    name: "Michele Figueiredo",
    event: "Aniversário infantil",
    avatar: "/assets/depoimentos/michele-figueiredo.png",
  },
  {
    text: "Realizei o meu Casamento com Fa & Gu e foi tudo perfeito!!! A Erika além de ser uma excelente Cerimonialista tem uma equipe eficiente e que esbanja simpatia. Super recomendo a todos!",
    name: "Evelyn Naiara",
    event: "Casamento",
    avatar: "/assets/depoimentos/evelyn-naiara.png",
  },
  {
    text: "Ótimo custo benefício, fartura e diversidade por um valor acessível. Além do atendimento personalizado e prestativo. Parabéns pelo serviço. OBS: Dica, peça o bolo de creme belga com pedaços de morango",
    name: "Igor Fedel",
    event: "Buffet",
    avatar: "/assets/depoimentos/igor-fedel.png",
  },
  {
    text: "Realizei minha festinha com amigos e contratei os salgadinhos e o bolo salgado com a Erica. Tudo muito gostoso e a Érica foi muito prestativa. Parabéns pelo trabalho realizado!",
    name: "Eliane dos Santos Andrade Justino",
    event: "Festa entre amigos",
    avatar: "/assets/depoimentos/eliane-justino.png",
  },
  {
    text: "Realizei meu casamentos com o Buffet e superaram minhas expectativas, foi tudo maravilhoso além o que sonhei. Trabalho impecável.",
    name: "Bruna Marques",
    event: "Casamento",
    avatar: "/assets/depoimentos/bruna-marques.png",
  },
  {
    text: "Foi melhor q eu esperava, foi tudo maravilhoso 🤩🥰 eu amei cada detalhe lindo perfeito 😍",
    name: "Eliane Oliveira",
    event: "Casamento",
    avatar: "/assets/depoimentos/eliane-oliveira.png",
  },
];

// Fotos do portfólio (public/assets/portfolio), na ordem do mosaico: [arquivo, rótulo, descrição, largura, altura].
// Largura e altura reservam o espaço de cada foto, para o mosaico não "pular" enquanto elas carregam.
const portfolioPhotos = [
  ["foto-04.jpg", "Casamento", "Noivos no jardim com o véu ao vento", 720, 500],
  ["foto-21.jpg", "Doces", "Docinhos de chocolate com cereja", 1280, 853],
  ["foto-14.jpg", "Festa infantil", "Mesa com A Bela e a Fera e Homem-Aranha", 720, 599],
  ["foto-09.jpg", "Casamento", "Equipe arrumando a cauda do vestido para a foto dos noivos", 1280, 854],
  ["foto-10.jpg", "Buffet", "Tábuas de frios com salame, queijos, azeitonas e uvas", 960, 1280],
  ["foto-03.jpg", "15 anos", "Decoração em azul-turquesa com flores", 720, 480],
  ["foto-17.jpg", "Casamento", "Noivos e padrinhos comemorando no jardim", 720, 474],
  ["foto-25.jpg", "Casamento", "Bolo de quatro andares com topo personalizado", 853, 1280],
  ["foto-01.jpg", "Festa infantil", "Mesa com tema de super-heróis", 1600, 1200],
  ["foto-31.jpg", "Casamento", "Equipe ajeitando a cauda do vestido na entrada da noiva", 853, 1280],
  ["foto-23.jpg", "Doces", "Brigadeiros em forminhas verdes", 1280, 853],
  ["foto-24.jpg", "15 anos", "Mesa da Rafaela com bolo azul e flores", 720, 480],
  ["foto-05.jpg", "Casamento", "Placa de boas-vindas de Eliana e Carlos", 853, 1280],
  ["foto-13.jpg", "Barraquinha", "Carrinho de churros gourmet", 720, 1280],
  ["foto-34.jpg", "Festa infantil", "Mesa com tema Moranguinho", 692, 672],
  ["foto-11.jpg", "Casamento", "Noivos e cerimonialista junto ao bolo", 960, 1280],
  ["foto-26.jpg", "Doces", "Bandejas de docinhos finos", 1280, 854],
  ["foto-08.jpg", "Mesa posta", "Arranjo de rosas sobre toalha marsala", 623, 350],
  ["foto-06.jpg", "Casamento", "Últimos ajustes no vestido da noiva", 853, 1280],
  ["foto-22.jpg", "Festa infantil", "Painel colorido com arco de balões", 1280, 960],
  ["foto-33.jpg", "Casamento", "Topo de bolo com os noivos", 1280, 853],
  ["foto-16.jpg", "Buffet", "Montagem das tábuas de frios", 960, 1280],
  ["foto-18.jpg", "Casamento", "Equipe ajudando a noiva a descer do carro", 1280, 853],
  ["foto-07.jpg", "Aniversário", "Mesa em amarelo e branco com balões", 1280, 960],
  ["foto-28.jpg", "Casamento", "Cuidado com cada detalhe antes da cerimônia", 1280, 853],
  ["foto-02.jpg", "Festa infantil", "Mesa com tema Princesa Sofia", 1500, 1600],
  ["foto-27.jpg", "Doces", "Docinhos em bandeja de vidro", 1280, 853],
  ["foto-19.jpg", "Mesa posta", "Louça branca e taças para o jantar", 623, 350],
  ["foto-32.jpg", "Casamento", "Noivos e cerimonialista na mesa do bolo", 1280, 853],
  ["foto-30.jpg", "Decoração", "Mesa de bolo rústica com flores", 1280, 853],
  ["foto-15.jpg", "Casamento", "Equipe ajudando a noiva antes da entrada", 853, 1280],
  ["foto-12.jpg", "Festa infantil", "Detalhes da mesa Princesa Sofia", 1200, 1280],
  ["foto-29.jpg", "Casamento", "Noivos e cerimonialista com o bolo azul", 960, 1280],
  ["foto-20.jpg", "Equipe", "A equipe Fa & Gu reunida", 1280, 960],
];

function renderProjects() {
  const projectGrid = document.querySelector(".project-grid");

  if (!projectGrid) return;

  projectGrid.innerHTML = projects
    .map(
      (project, index) => `
        <article class="project project-${index + 1}">
          <span class="project-number">${String(index + 1).padStart(2, "0")}</span>
          <div class="project-caption">
            <p>${project.type}</p>
            <h3>${project.title}</h3>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTestimonials() {
  const testimonialGrid = document.querySelector(".testimonial-grid");
  const testimonialCarousel = document.querySelector(".testimonial-carousel");
  const testimonialDots = document.querySelector(".testimonial-dots");

  if (testimonialGrid) {
    testimonialGrid.innerHTML = testimonials
      .map(
        (testimonial) => `
          <article>
            <div class="stars" aria-label="5 estrelas">★★★★★</div>
            <p>“${testimonial.text}”</p>
            <div class="testimonial-author">
              <img src="${testimonial.avatar}" alt="" loading="lazy" />
              <div>
                <strong>${testimonial.name}</strong>
                <small>${testimonial.event} · Google</small>
              </div>
            </div>
          </article>
        `,
      )
      .join("");
  }

  if (testimonialCarousel && testimonialDots) {
    testimonialCarousel.innerHTML = testimonials
      .map(
        (testimonial, index) => `
          <article class="testimonial-slide${index === 0 ? " is-active" : ""}">
            <img class="testimonial-avatar" src="${testimonial.avatar}" alt="${testimonial.name}" loading="lazy" />
            <div class="stars" aria-label="5 estrelas">★★★★★</div>
            <blockquote>“${testimonial.text}”</blockquote>
            <strong>${testimonial.name}</strong><span>${testimonial.event} · avaliação no Google</span>
          </article>
        `,
      )
      .join("");
    testimonialDots.innerHTML = testimonials
      .map(
        (_, index) =>
          `<button${index === 0 ? ' class="is-active"' : ""} aria-label="Ver depoimento ${index + 1}"></button>`,
      )
      .join("");
  }
}

function setupHeroVideo() {
  const video = document.querySelector(".hero-video");

  if (video) video.src = heroVideo;
}

function setupMenu() {
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");

  if (!menuButton || !navigation) return;

  menuButton.addEventListener("click", () => {
    navigation.classList.toggle("is-open");
  });
}

function setupScrollAnimations() {
  const animatedElements = document.querySelectorAll(
    ".intro, .services, .portfolio, .mission, .testimonials, .contact, .service-list article, .project",
  );

  animatedElements.forEach((element) => {
    element.classList.add("js-reveal");
  });

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14 },
  );

  animatedElements.forEach((element) => revealObserver.observe(element));
}

function setupInternalExperience() {
  if (!document.body.classList.contains("inner-page")) return;

  const revealSections = document.querySelectorAll(".reveal-section");

  revealSections.forEach((section) => {
    gsap.to(section, {
      autoAlpha: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: section,
        start: "top 82%",
        once: true,
      },
    });
  });

  const hero = document.querySelector(".page-hero--story");
  if (hero && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.to(hero.querySelector(".hero-orbit"), {
      y: -80,
      rotation: 25,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(hero.querySelector("h1"), {
      y: 55,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  }

  document.querySelectorAll(".event-card__top").forEach((top) => {
    top.addEventListener("click", () => {
      const card = top.closest(".event-card");
      card.parentElement.querySelectorAll(".event-card.is-open").forEach((openCard) => {
        if (openCard !== card) openCard.classList.remove("is-open");
      });
      card.classList.toggle("is-open");
    });
  });

  document.querySelectorAll("[data-years-since]").forEach((element) => {
    element.dataset.count = new Date().getFullYear() - Number(element.dataset.yearsSince);
  });
  const counters = document.querySelectorAll("[data-count]");
  counters.forEach((counter) => {
    const target = Number(counter.dataset.count);
    const state = { value: 0 };
    gsap.to(state, {
      value: target,
      duration: 1.8,
      ease: "power2.out",
      snap: { value: 1 },
      scrollTrigger: { trigger: counter, start: "top 88%", once: true },
      onUpdate: () => { counter.textContent = Math.round(state.value); },
    });
  });

  const slides = [...document.querySelectorAll(".testimonial-slide")];
  const dots = [...document.querySelectorAll(".testimonial-dots button")];
  let currentSlide = 0;
  const showSlide = (index) => {
    if (!slides.length) return;
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === currentSlide));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === currentSlide));
  };
  document.querySelector(".testimonial-prev")?.addEventListener("click", () => showSlide(currentSlide - 1));
  document.querySelector(".testimonial-next")?.addEventListener("click", () => showSlide(currentSlide + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
  if (slides.length > 1) window.setInterval(() => showSlide(currentSlide + 1), 6500);
}

function setupMenuTabs() {
  const tabs = document.querySelectorAll("[data-menu-tab]");
  const panels = document.querySelectorAll("[data-menu-panel]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.menuPanel !== tab.dataset.menuTab; });
    });
  });
}

// Portfólio: mosaico com todas as fotos inteiras; clicar abre a foto em tela cheia, com setas para passar.
function setupPortfolioGallery() {
  const grid = document.querySelector("[data-portfolio-grid]");
  const viewer = document.querySelector("[data-portfolio-viewer]");
  if (!grid || !viewer) return;

  const viewerImage = viewer.querySelector(".viewer-image");
  const viewerTag = viewer.querySelector(".viewer-tag");
  const viewerCount = viewer.querySelector(".viewer-count");
  const photoUrl = (file) => `/assets/portfolio/${file}`;
  const pad = (number) => String(number).padStart(2, "0");
  let index = 0;

  const open = (position) => {
    index = (position + portfolioPhotos.length) % portfolioPhotos.length;
    const [file, label, description] = portfolioPhotos[index];
    viewerImage.src = photoUrl(file);
    viewerImage.alt = description;
    viewerTag.textContent = label;
    viewerCount.textContent = `${pad(index + 1)} / ${pad(portfolioPhotos.length)}`;
    // Já busca as vizinhas, para a próxima foto aparecer na hora.
    [index + 1, index - 1].forEach((neighbor) => {
      new Image().src = photoUrl(portfolioPhotos[(neighbor + portfolioPhotos.length) % portfolioPhotos.length][0]);
    });
    if (!viewer.open) viewer.showModal();
  };

  grid.append(
    ...portfolioPhotos.map(([file, label, description, width, height], position) => {
      const item = createElement("button", "mosaic-item");
      item.type = "button";
      item.setAttribute("aria-label", `Ampliar foto: ${description}`);
      const image = createElement("img");
      Object.assign(image, { src: photoUrl(file), alt: description, width, height, loading: "lazy", decoding: "async" });
      item.append(image, createElement("span", "mosaic-tag", label));
      item.addEventListener("click", () => open(position));
      return item;
    }),
  );

  viewer.querySelector(".viewer-prev").addEventListener("click", () => open(index - 1));
  viewer.querySelector(".viewer-next").addEventListener("click", () => open(index + 1));
  viewer.querySelector(".viewer-close").addEventListener("click", () => viewer.close());
  // Clique fora da foto (no fundo escuro) fecha.
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") open(index - 1);
    else if (event.key === "ArrowRight") open(index + 1);
  });

  let swipeStart = null;
  viewer.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") swipeStart = event.clientX;
  });
  viewer.addEventListener("pointerup", (event) => {
    if (swipeStart === null) return;
    const distance = event.clientX - swipeStart;
    swipeStart = null;
    if (Math.abs(distance) > 50) open(index + (distance < 0 ? 1 : -1));
  });
}

// Vídeo dos bastidores: toca sem som e em loop só enquanto está na tela.
function setupBackstageVideo() {
  const video = document.querySelector(".backstage-video");
  if (!video) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    video.controls = true;
    return;
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) video.play().catch(() => {});
    else video.pause();
  }, { threshold: 0.4 }).observe(video);
}

async function setupBudgetSimulator() {
  const form = document.querySelector("#budget-form");
  if (!form) return;

  const guestsInput = form.elements.namedItem("guests");
  const eventTypeInput = form.elements.namedItem("eventType");
  const packageOutput = document.querySelector("#budget-package");
  const guestsOutput = document.querySelector("#budget-guests");
  const feedback = document.querySelector("#budget-feedback");
  const submit = document.querySelector("#budget-submit");
  // Simulação só com cadastro: sem sessão, o envio leva ao login e depois volta para cá.
  const loginUrl = `/pages/acesso.html?next=${encodeURIComponent("/pages/servicos-para-eventos.html#simulador")}`;
  let loggedIn = false;
  const requireLogin = () => {
    loggedIn = false;
    submit.firstChild.textContent = "Entrar para enviar ";
    feedback.textContent = "Para enviar sua simulação, entre ou crie sua conta.";
    feedback.className = "budget-feedback";
  };
  // Cada tipo de evento mostra só os seus cardápios e adicionais; "all" (evento especial) mostra todos.
  const filterByEventType = () => {
    const menu = eventTypeInput.selectedOptions[0]?.dataset.menu || "all";
    form.querySelectorAll(".menu-option[data-menu]").forEach((option) => {
      const visible = menu === "all" || option.dataset.menu === menu;
      option.hidden = !visible;
      if (!visible) option.querySelector("input").checked = false;
    });
    if (!form.querySelector('input[name="menuPackage"]:checked')) {
      const firstVisible = form.querySelector('.menu-option:not([hidden]) input[name="menuPackage"]');
      if (firstVisible) firstVisible.checked = true;
    }
  };

  const calculate = () => {
    const guests = Math.max(20, Number(guestsInput.value) || 20);
    const selectedPackage = form.querySelector('input[name="menuPackage"]:checked');
    guestsOutput.textContent = guests;
    packageOutput.textContent = selectedPackage?.value || "Escolha um cardápio";
    form.querySelectorAll(".menu-option").forEach((option) => {
      option.classList.toggle("is-selected", option.querySelector("input")?.checked);
    });
    return { guests, selectedPackage };
  };

  eventTypeInput.addEventListener("change", filterByEventType);
  form.addEventListener("input", calculate);
  form.addEventListener("change", calculate);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loggedIn) {
      window.location.href = loginUrl;
      return;
    }
    const { guests, selectedPackage } = calculate();
    const data = new FormData(form);
    const addons = data.getAll("addons");
    const phone = String(data.get("phone") || "").trim();
    if (phone.replace(/\D/g, "").length < 10) {
      feedback.textContent = "Informe um telefone válido com DDD.";
      feedback.className = "budget-feedback is-error";
      form.elements.phone.focus();
      return;
    }
    feedback.textContent = "Enviando sua simulação...";
    feedback.className = "budget-feedback";

    try {
      const response = await fetch(`${apiBaseUrl}/api/quotes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone,
          eventType: data.get("eventType"),
          eventDate: data.get("eventDate"),
          guests,
          menuPackage: selectedPackage?.value,
          menuItems: addons,
          message: `Simulação: ${selectedPackage?.value}; adicionais: ${addons.join(", ") || "nenhum"}.`,
        }),
      });
      if (response.status === 401) {
        requireLogin();
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a simulação.");
      feedback.textContent = "Recebemos sua simulação. Em breve a gente entra em contato.";
      feedback.classList.add("is-success");
    } catch (error) {
      feedback.textContent = "Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.";
      feedback.classList.add("is-error");
    }
  });

  filterByEventType();
  calculate();

  try {
    const response = await fetchSession();
    if (!response.ok) return requireLogin();
    const { user } = await response.json();
    loggedIn = true;
    if (!form.elements.name.value) form.elements.name.value = user.name;
    if (!form.elements.email.value) form.elements.email.value = user.email;
  } catch {
    requireLogin();
  }
}

async function setupSessionNavigation() {
  const navigation = document.querySelector(".main-nav");
  if (!navigation) return;

  let accountLink = navigation.querySelector("[data-account-link]");
  if (!accountLink) {
    const existingAccessLink = Array.from(navigation.querySelectorAll("a")).find((link) =>
      link.getAttribute("href")?.includes("/pages/acesso.html"),
    );
    accountLink = existingAccessLink || document.createElement("a");
    accountLink.dataset.accountLink = "";
    if (!existingAccessLink) navigation.append(accountLink);
  }

  accountLink.href = "/pages/acesso.html";
  accountLink.textContent = "Acesso";
  accountLink.removeAttribute("title");

  try {
    const response = await fetchSession();
    if (!response.ok) return;
    const { user } = await response.json();
    const firstName = user.name?.trim().split(/\s+/)[0] || "Minha conta";
    accountLink.href = user.role === "admin" ? "/pages/admin.html" : "/pages/minha-conta.html";
    accountLink.textContent = `Olá, ${firstName}`;
    accountLink.title = "Abrir minha conta";
  } catch {
    // Mantém o link de acesso quando a API não estiver disponível.
  }
}

async function setupAuth() {
  const form = document.querySelector("#auth-form");
  const panel = document.querySelector("#account-panel");
  if (!form || !panel) return;

  const title = document.querySelector("#auth-title");
  const nameField = document.querySelector("#name-field");
  const submit = document.querySelector("#auth-submit");
  const switchButton = document.querySelector("#auth-switch");
  const feedback = document.querySelector("#auth-feedback");
  const accountName = document.querySelector("#account-name");
  const quoteList = document.querySelector("#quote-list");
  let registering = false;
  // Volta para a página de origem (ex.: simulador) após o login; só aceita caminhos internos.
  const next = new URLSearchParams(window.location.search).get("next");
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : null;
  const redirectAfterLogin = (user) =>
    window.location.replace(user.role === "admin" ? "/pages/admin.html" : safeNext || "/pages/minha-conta.html");

  const showAccount = async (user) => {
    feedback.textContent = "";
    feedback.className = "auth-feedback";
    feedback.hidden = true;
    form.hidden = true;
    switchButton.hidden = true;
    panel.hidden = false;
    accountName.textContent = user.name;
    const response = await fetch(`${apiBaseUrl}/api/my/quotes`, { credentials: "include" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar seus orçamentos.");
    if (!Array.isArray(result.quotes)) throw new Error("A resposta da API de orçamentos é inválida.");
    renderClientQuotes(quoteList, result.quotes);
  };

  try {
    const response = await fetchSession();
    if (response.ok) {
      const { user } = await response.json();
      redirectAfterLogin(user);
      return;
    }
    else if (response.status !== 401) {
      const result = await response.json();
      throw new Error(result.error || "Não foi possível verificar a sessão.");
    }
  } catch {
    feedback.textContent = "Não foi possível conectar ao servidor.";
    feedback.className = "auth-feedback is-error";
  }

  switchButton.addEventListener("click", () => {
    registering = !registering;
    feedback.textContent = "";
    feedback.className = "auth-feedback";
    title.textContent = registering ? "Crie sua conta." : "Entre na sua conta.";
    nameField.hidden = !registering;
    nameField.querySelector("input").required = registering;
    submit.firstChild.textContent = registering ? "Criar conta " : "Entrar ";
    switchButton.textContent = registering ? "Já tenho uma conta" : "Ainda não tenho uma conta";
    form.elements.password.autocomplete = registering ? "new-password" : "current-password";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    feedback.textContent = "Aguarde...";
    feedback.className = "auth-feedback";
    feedback.hidden = false;
    const body = Object.fromEntries(new FormData(form));
    body.email = body.email.trim();
    if (!registering) delete body.name;
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email);
    if (registering && !body.name.trim()) {
      feedback.textContent = "Informe seu nome.";
      feedback.className = "auth-feedback is-error";
      return;
    }
    if (!emailIsValid) {
      feedback.textContent = "Informe um e-mail válido.";
      feedback.className = "auth-feedback is-error";
      return;
    }
    if (body.password.length < 8) {
      feedback.textContent = "A senha deve ter pelo menos 8 caracteres.";
      feedback.className = "auth-feedback is-error";
      return;
    }
    submit.disabled = true;
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir o acesso.");
      redirectAfterLogin(result.user);
    } catch (error) {
      feedback.textContent =
        error instanceof TypeError ? "Não foi possível conectar ao servidor. Tente novamente." : error.message;
      feedback.className = "auth-feedback is-error";
      submit.disabled = false;
    }
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.reload();
  });
}

// Lista de orçamentos do cliente: um cartão por pedido, com o status em destaque e os principais dados.
function renderClientQuotes(list, quotes) {
  if (!quotes.length) {
    list.replaceChildren(createElement("li", "quote-empty", "Nenhum orçamento enviado ainda."));
    return;
  }
  list.replaceChildren(
    ...quotes.map((quote) => {
      const item = createElement("li", "quote-card");
      const head = createElement("div", "quote-card-head");
      head.append(
        createElement("strong", "", quote.eventType || "Evento"),
        createElement("span", `quote-status quote-status--${quote.status}`, statusLabels[quote.status] || quote.status),
      );
      const details = createElement("dl", "quote-card-details");
      [
        ["Data do evento", quote.eventDate && formatDate(`${quote.eventDate}T12:00:00`)],
        ["Convidados", quote.guests],
        ["Cardápio", quote.menuPackage],
        ["Enviado em", formatDate(quote.createdAt)],
      ].forEach(([label, value]) => {
        if (value === undefined || value === null || value === "") return;
        const group = createElement("div");
        group.append(createElement("dt", "", label), createElement("dd", "", String(value)));
        details.append(group);
      });
      item.append(head, details);
      return item;
    }),
  );
}

async function setupAccountPage() {
  const accountPage = document.querySelector("#account-page");
  if (!accountPage) return;

  const name = document.querySelector("#account-page-name");
  const quoteList = document.querySelector("#account-page-quotes");
  const feedback = document.querySelector("#account-page-feedback");

  try {
    const sessionResponse = await fetchSession();
    if (!sessionResponse.ok) {
      window.location.replace("/pages/acesso.html");
      return;
    }

    const { user } = await sessionResponse.json();
    if (user.role === "admin") {
      window.location.replace("/pages/admin.html");
      return;
    }
    const quotesResponse = await fetch(`${apiBaseUrl}/api/my/quotes`, { credentials: "include" });
    const quotesResult = await quotesResponse.json();
    if (!quotesResponse.ok || !Array.isArray(quotesResult.quotes)) {
      throw new Error(quotesResult.error || "Não foi possível carregar seus orçamentos.");
    }

    name.textContent = user.name;
    renderClientQuotes(quoteList, quotesResult.quotes);
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = "auth-feedback is-error";
  }

  document.querySelector("#account-page-logout").addEventListener("click", async () => {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/pages/acesso.html";
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const formatMoney = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function renderAdminQuote(quote, feedback) {
  const item = createElement("article", "admin-quote");
  const head = createElement("div", "admin-quote-head");
  const title = createElement("div");
  title.append(createElement("strong", "", quote.name), createElement("span", "", `Recebido em ${formatDate(quote.createdAt)}`));

  const status = createElement("select");
  status.setAttribute("aria-label", `Status do pedido de ${quote.name}`);
  Object.entries(statusLabels).forEach(([value, label]) => status.append(new Option(label, value, false, value === quote.status)));
  status.addEventListener("change", async () => {
    status.disabled = true;
    const response = await fetch(`${apiBaseUrl}/api/quotes/${quote.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status.value }),
    }).catch(() => null);
    if (!response?.ok) {
      status.value = quote.status;
      feedback.textContent = "Não foi possível atualizar o status.";
      feedback.className = "auth-feedback is-error";
    } else {
      quote.status = status.value;
      item.dataset.status = quote.status;
      feedback.textContent = "Status atualizado.";
      feedback.className = "auth-feedback is-success";
    }
    status.disabled = false;
  });
  const exportLink = createElement("a", "admin-quote-export", "Exportar (CSV)");
  exportLink.href = `${apiBaseUrl}/api/admin/export/quotes/${encodeURIComponent(quote.id)}.csv`;
  exportLink.download = "";
  const controls = createElement("div", "admin-quote-controls");
  controls.append(status, exportLink);
  head.append(title, controls);

  const details = createElement("dl", "admin-quote-details");
  const email = createElement("a", "", quote.email);
  email.href = `mailto:${quote.email}`;
  [
    ["E-mail", email],
    ["Telefone", quote.phone],
    ["Evento", quote.eventType],
    ["Data do evento", quote.eventDate && formatDate(`${quote.eventDate}T12:00:00`)],
    ["Convidados", quote.guests],
    ["Pacote", quote.menuPackage],
    ["Adicionais", quote.menuItems?.join(", ")],
    ["Estimativa", quote.estimate && formatMoney(quote.estimate)],
  ].forEach(([label, value]) => {
    if (value === undefined || value === null || value === "") return;
    const group = createElement("div");
    const description = createElement("dd");
    description.append(value);
    group.append(createElement("dt", "", label), description);
    details.append(group);
  });

  item.dataset.status = quote.status;
  item.append(head, details, createElement("p", "admin-quote-message", quote.message));
  return item;
}

function renderAdminUser(user, feedback, onDelete) {
  const item = createElement("article", "admin-user");
  const info = createElement("div");
  info.append(createElement("strong", "", user.name), createElement("span", "", user.email));
  const meta = createElement("div", "admin-user-meta");
  meta.append(
    createElement("span", "", user.role === "admin" ? "Administrador" : "Cliente"),
    createElement("span", "", `Desde ${formatDate(user.createdAt)}`),
    createElement("span", "", `${user.quoteCount} ${user.quoteCount === 1 ? "orçamento" : "orçamentos"}`),
  );
  if (user.role === "client") {
    const remove = createElement("button", "admin-user-delete", "Excluir");
    remove.type = "button";
    remove.setAttribute("aria-label", `Excluir a conta de ${user.name}`);
    remove.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Excluir a conta de ${user.name} (${user.email})?\n\nOs orçamentos enviados por esse cliente continuam no sistema. Essa ação não pode ser desfeita.`,
      );
      if (!confirmed) return;
      remove.disabled = true;
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => null);
      if (!response?.ok) {
        remove.disabled = false;
        feedback.textContent = "Não foi possível excluir o cliente.";
        feedback.className = "auth-feedback is-error";
        return;
      }
      item.remove();
      onDelete();
      feedback.textContent = `Conta de ${user.name} excluída.`;
      feedback.className = "auth-feedback is-success";
    });
    meta.append(remove);
  }
  item.append(info, meta);
  return item;
}

async function setupAdminPage() {
  const adminPage = document.querySelector("#admin-page");
  if (!adminPage) return;

  const quoteList = document.querySelector("#admin-quote-list");
  const userList = document.querySelector("#admin-user-list");
  const statusFilter = document.querySelector("#admin-status-filter");
  const feedback = document.querySelector("#admin-feedback");
  const tabs = [...adminPage.querySelectorAll("[data-admin-tab]")];

  document.querySelector("#admin-logout").addEventListener("click", async () => {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/pages/acesso.html";
  });
  adminPage.querySelectorAll("[data-admin-download]").forEach((link) => {
    link.href = `${apiBaseUrl}${link.dataset.adminDownload}`;
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((other) => {
        const selected = other === tab;
        other.setAttribute("aria-selected", String(selected));
        document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
      });
    });
  });
  statusFilter.addEventListener("change", () => {
    quoteList.querySelectorAll(".admin-quote").forEach((item) => {
      item.hidden = Boolean(statusFilter.value) && item.dataset.status !== statusFilter.value;
    });
  });

  try {
    const sessionResponse = await fetchSession();
    if (!sessionResponse.ok) {
      window.location.replace("/pages/acesso.html");
      return;
    }
    const { user } = await sessionResponse.json();
    if (user.role !== "admin") {
      window.location.replace("/pages/minha-conta.html");
      return;
    }

    const [quotesResponse, usersResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/quotes`, { credentials: "include" }),
      fetch(`${apiBaseUrl}/api/admin/users`, { credentials: "include" }),
    ]);
    const [quotesResult, usersResult] = await Promise.all([quotesResponse.json(), usersResponse.json()]);
    if (!quotesResponse.ok) throw new Error(quotesResult.error || "Não foi possível carregar os orçamentos.");
    if (!usersResponse.ok) throw new Error(usersResult.error || "Não foi possível carregar os clientes.");

    document.querySelector("#admin-quote-count").textContent = quotesResult.quotes.length;
    const userCount = document.querySelector("#admin-user-count");
    userCount.textContent = usersResult.users.length;
    const onUserDeleted = () => {
      userCount.textContent = Number(userCount.textContent) - 1;
      if (!userList.querySelector(".admin-user")) userList.append(createElement("p", "admin-empty", "Nenhum cliente cadastrado ainda."));
    };
    quoteList.replaceChildren(
      ...(quotesResult.quotes.length
        ? quotesResult.quotes.map((quote) => renderAdminQuote(quote, feedback))
        : [createElement("p", "admin-empty", "Nenhum orçamento recebido ainda.")]),
    );
    userList.replaceChildren(
      ...(usersResult.users.length
        ? usersResult.users.map((user) => renderAdminUser(user, feedback, onUserDeleted))
        : [createElement("p", "admin-empty", "Nenhum cliente cadastrado ainda.")]),
    );
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = "auth-feedback is-error";
  }
}

renderProjects();
renderTestimonials();
setupHeroVideo();
setupMenu();
setupScrollAnimations();
setupInternalExperience();
setupMenuTabs();
setupPortfolioGallery();
setupBackstageVideo();
setupBudgetSimulator();
setupSessionNavigation();
setupAuth();
setupAccountPage();
setupAdminPage();
