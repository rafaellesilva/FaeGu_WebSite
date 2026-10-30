import "./styles/style.css";
import "./styles/pages.css";
import heroVideo from "./assets/video/12759458_1920_1080_25fps.mp4";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
// Vazio = mesma origem do site (produção, e em desenvolvimento via proxy do Vite).
const apiBaseUrl = import.meta.env.VITE_API_URL || "";

const statusLabels = { new: "Novo", contacted: "Em contato", scheduled: "Agendado", closed: "Encerrado" };
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : "");

const projects = [
  {
    type: "Casamento",
    title: "Um sim para sempre",
    image:
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=85",
  },
  {
    type: "15 anos",
    title: "Uma noite para lembrar",
    image:
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85",
  },
  {
    type: "Corporativo",
    title: "Ideias que conectam",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85",
  },
];

const testimonials = [
  {
    text: "A Fa & Gu entendeu exatamente o que imaginávamos. O dia foi leve, lindo e muito mais especial do que sonhamos.",
    name: "Mariana & Lucas",
    event: "Casamento",
  },
  {
    text: "Cada detalhe tinha a nossa cara. Foi uma festa inesquecível e nós conseguimos aproveitar tudo sem preocupação.",
    name: "Juliana Alves",
    event: "15 anos",
  },
  {
    text: "Profissionalismo, criatividade e muito carinho em cada etapa. Nosso evento corporativo foi um sucesso.",
    name: "Rafael Mendes",
    event: "Evento corporativo",
  },
];

function renderProjects() {
  const projectGrid = document.querySelector(".project-grid");

  if (!projectGrid) return;

  projectGrid.innerHTML = projects
    .map(
      (project, index) => `
        <article class="project project-${index + 1}">
          <img src="${project.image}" alt="${project.title}" />
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

  if (!testimonialGrid) return;

  testimonialGrid.innerHTML = testimonials
    .map(
      (testimonial) => `
        <article>
          <div class="stars" aria-label="5 estrelas">★★★★★</div>
          <p>“${testimonial.text}”</p>
          <strong>${testimonial.name}</strong>
          <small>${testimonial.event}</small>
        </article>
      `,
    )
    .join("");
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
      document.querySelectorAll(".event-card.is-open").forEach((openCard) => {
        if (openCard !== card) openCard.classList.remove("is-open");
      });
      card.classList.toggle("is-open");
    });
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

  const filterButtons = document.querySelectorAll(".gallery-filters button");
  const galleryItems = document.querySelectorAll(".gallery-item");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const filter = button.dataset.filter;
      galleryItems.forEach((item) => {
        const visible = filter === "all" || item.dataset.category === filter;
        gsap.to(item, { autoAlpha: visible ? 1 : 0, scale: visible ? 1 : 0.96, duration: 0.3, onComplete: () => { item.hidden = !visible; } });
      });
    });
  });

  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  document.querySelectorAll("[data-lightbox]").forEach((item) => {
    item.addEventListener("click", () => {
      if (!lightbox || !lightboxImage) return;
      lightboxImage.src = item.dataset.lightbox;
      lightboxImage.alt = item.querySelector("img")?.alt || "Imagem ampliada";
      lightbox.classList.add("is-visible");
      lightbox.setAttribute("aria-hidden", "false");
    });
  });
  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("is-visible");
    lightbox.setAttribute("aria-hidden", "true");
  };
  lightbox?.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLightbox(); });

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

function setupBudgetSimulator() {
  const form = document.querySelector("#budget-form");
  if (!form) return;

  const guestsInput = form.elements.namedItem("guests");
  const totalOutput = document.querySelector("#budget-total");
  const guestsOutput = document.querySelector("#budget-guests");
  const feedback = document.querySelector("#budget-feedback");
  const formatCurrency = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const calculate = () => {
    const guests = Math.max(20, Number(guestsInput.value) || 20);
    const selectedPackage = form.querySelector('input[name="menuPackage"]:checked');
    const packagePrice = Number(selectedPackage?.dataset.price || 0);
    const addonsPrice = [...form.querySelectorAll('input[name="addons"]:checked')]
      .reduce((total, addon) => total + Number(addon.dataset.price || 0), 0);
    const total = guests * (packagePrice + addonsPrice);
    guestsOutput.textContent = guests;
    totalOutput.textContent = formatCurrency(total);
    form.querySelectorAll(".menu-option").forEach((option) => {
      option.classList.toggle("is-selected", option.querySelector("input")?.checked);
    });
    return { guests, selectedPackage, total };
  };

  form.addEventListener("input", calculate);
  form.addEventListener("change", calculate);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { guests, selectedPackage, total } = calculate();
    const data = new FormData(form);
    const addons = data.getAll("addons");
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
          eventType: data.get("eventType"),
          eventDate: data.get("eventDate"),
          guests,
          menuPackage: selectedPackage?.value,
          menuItems: addons,
          estimate: total,
          message: `Simulação: ${selectedPackage?.value}; adicionais: ${addons.join(", ") || "nenhum"}; estimativa: ${formatCurrency(total)}.`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a simulação.");
      feedback.textContent = "Recebemos sua simulação. Em breve a gente entra em contato.";
      feedback.classList.add("is-success");
    } catch (error) {
      feedback.textContent = "Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.";
      feedback.classList.add("is-error");
    }
  });

  calculate();
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
    quoteList.replaceChildren();
    if (!result.quotes.length) {
      quoteList.textContent = "Nenhum orçamento enviado ainda.";
      return;
    }
    result.quotes.forEach((quote) => {
      const item = document.createElement("li");
      const eventType = document.createElement("strong");
      const status = document.createElement("span");
      eventType.textContent = quote.eventType || "Evento";
      status.textContent = statusLabels[quote.status] || quote.status;
      item.append(eventType, status);
      quoteList.append(item);
    });
  };

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
    if (response.ok) {
      const { user } = await response.json();
      window.location.replace(user.role === "admin" ? "/pages/admin.html" : "/pages/minha-conta.html");
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
      window.location.replace(result.user.role === "admin" ? "/pages/admin.html" : "/pages/minha-conta.html");
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

async function setupAccountPage() {
  const accountPage = document.querySelector("#account-page");
  if (!accountPage) return;

  const name = document.querySelector("#account-page-name");
  const quoteList = document.querySelector("#account-page-quotes");
  const feedback = document.querySelector("#account-page-feedback");

  try {
    const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
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
    quoteList.replaceChildren();
    if (!quotesResult.quotes.length) {
      quoteList.textContent = "Nenhum orçamento enviado ainda.";
    } else {
      quotesResult.quotes.forEach((quote) => {
        const item = document.createElement("li");
        const eventType = document.createElement("strong");
        const status = document.createElement("span");
        eventType.textContent = quote.eventType || "Evento";
        status.textContent = statusLabels[quote.status] || quote.status;
        item.append(eventType, status);
        quoteList.append(item);
      });
    }
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
  head.append(title, status);

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

function renderAdminUser(user) {
  const item = createElement("article", "admin-user");
  const info = createElement("div");
  info.append(createElement("strong", "", user.name), createElement("span", "", user.email));
  const meta = createElement("div", "admin-user-meta");
  meta.append(
    createElement("span", "", user.role === "admin" ? "Administrador" : "Cliente"),
    createElement("span", "", `Desde ${formatDate(user.createdAt)}`),
    createElement("span", "", `${user.quoteCount} ${user.quoteCount === 1 ? "orçamento" : "orçamentos"}`),
  );
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
    const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
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
    document.querySelector("#admin-user-count").textContent = usersResult.users.length;
    quoteList.replaceChildren(
      ...(quotesResult.quotes.length
        ? quotesResult.quotes.map((quote) => renderAdminQuote(quote, feedback))
        : [createElement("p", "admin-empty", "Nenhum orçamento recebido ainda.")]),
    );
    userList.replaceChildren(
      ...(usersResult.users.length
        ? usersResult.users.map(renderAdminUser)
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
setupBudgetSimulator();
setupAuth();
setupAccountPage();
setupAdminPage();
