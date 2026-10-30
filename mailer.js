import nodemailer from "nodemailer";

// E-mails do site: aviso de orçamento novo para o admin e agradecimento para o cliente.
// Sem SMTP_HOST, SMTP_USER e SMTP_PASS configurados, nada é enviado e o site funciona normalmente.
const host = process.env.SMTP_HOST?.trim();
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS;
const port = Number(process.env.SMTP_PORT || 465);
const from = process.env.MAIL_FROM?.trim() || (user ? `Fa & Gu Eventos <${user}>` : "");
const adminTo = (process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const siteUrl = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");

export const mailEnabled = Boolean(host && user && pass);
const transport = mailEnabled ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }) : null;

const colors = { paper: "#fbf9f6", cream: "#f4efe8", ink: "#3b2718", gold: "#d8a028", muted: "#8c6239" };

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// "2026-12-12" -> "12/12/2026"; outros formatos passam como vieram.
const formatEventDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

function quoteRows(quote, { withContact }) {
  const rows = [
    ["Tipo de evento", quote.eventType],
    ["Data do evento", formatEventDate(quote.eventDate)],
    ["Convidados", quote.guests],
    ["Cardápio", quote.menuPackage],
    ["Adicionais", quote.menuItems?.join(", ")],
  ];
  if (withContact) rows.unshift(["Nome", quote.name], ["Telefone", quote.phone], ["E-mail", quote.email]);
  return rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

// Layout com tabelas e estilos inline, que é o que os programas de e-mail (Gmail, Outlook) entendem.
function renderHtml({ kicker, title, paragraphs, rows, button }) {
  const logo = siteUrl
    ? `<img src="${escapeHtml(siteUrl)}/assets/brand/logo.png" width="96" alt="Fa &amp; Gu Eventos" style="display:block;margin:0 0 28px;" />`
    : "";
  const table = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eadfce;color:${colors.muted};font:11px/1.4 monospace;letter-spacing:1px;text-transform:uppercase;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eadfce;color:${colors.ink};font:15px/1.5 Arial,sans-serif;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  const cta = button
    ? `<p style="margin:32px 0 0;"><a href="${escapeHtml(button.href)}" style="display:inline-block;padding:14px 22px;background:${colors.gold};color:#ffffff;font:bold 12px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">${escapeHtml(button.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:${colors.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.cream};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${colors.paper};border-top:3px solid ${colors.gold};">
        <tr><td style="padding:40px 36px;">
          ${logo}
          <p style="margin:0 0 12px;color:${colors.muted};font:11px monospace;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(kicker)}</p>
          <h1 style="margin:0 0 20px;color:${colors.ink};font:normal 30px/1.15 Georgia,serif;">${escapeHtml(title)}</h1>
          ${paragraphs.map((text) => `<p style="margin:0 0 14px;color:${colors.ink};font:15px/1.7 Arial,sans-serif;">${escapeHtml(text)}</p>`).join("")}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #eadfce;">${table}</table>
          ${cta}
        </td></tr>
      </table>
      <p style="margin:20px 0 0;color:${colors.muted};font:12px Arial,sans-serif;">Fa &amp; Gu Eventos · Jacareí-SP · Celebrando histórias desde 2010</p>
    </td></tr>
  </table>
</body></html>`;
}

const renderText = ({ title, paragraphs, rows, button }) =>
  [title, "", ...paragraphs, "", ...rows.map(([label, value]) => `${label}: ${value}`), button ? `\n${button.label}: ${button.href}` : ""]
    .join("\n")
    .trim();

export function buildAdminEmail(quote) {
  const content = {
    kicker: "Novo pedido de orçamento",
    title: `${quote.name} quer um orçamento`,
    paragraphs: [
      "Chegou uma nova simulação pelo site. Os dados estão abaixo; responda este e-mail para falar direto com o cliente.",
      ...(quote.message ? [`Mensagem: ${quote.message}`] : []),
    ],
    rows: quoteRows(quote, { withContact: true }),
    button: siteUrl ? { label: "Abrir o painel", href: `${siteUrl}/pages/admin.html` } : null,
  };
  return {
    subject: `Novo orçamento: ${quote.eventType || "evento"} | ${quote.name}`,
    html: renderHtml(content),
    text: renderText(content),
  };
}

export function buildClientEmail(quote) {
  const firstName = quote.name.trim().split(/\s+/)[0];
  const content = {
    kicker: "Fa & Gu Eventos",
    title: `Recebemos seu pedido, ${firstName}!`,
    paragraphs: [
      "Muito obrigado por pensar na Fa & Gu para o seu evento. Já estamos olhando cada detalhe com carinho.",
      "Em breve entramos em contato pelo telefone ou e-mail informados. Se quiser adiantar a conversa, é só responder esta mensagem ou chamar a gente no WhatsApp (12) 98876-4245.",
      "Confira o resumo do que você enviou:",
    ],
    rows: quoteRows(quote, { withContact: false }),
    button: siteUrl ? { label: "Acompanhar meu pedido", href: `${siteUrl}/pages/minha-conta.html` } : null,
  };
  return {
    subject: "Recebemos seu pedido de orçamento | Fa & Gu Eventos",
    html: renderHtml(content),
    text: renderText(content),
  };
}

// Nunca rejeita: falhas de envio só vão para o log, para não atrapalhar o pedido do cliente.
export async function sendQuoteEmails(quote, clientAddress) {
  if (!mailEnabled) return;
  const messages = [];
  if (adminTo) messages.push({ to: adminTo, replyTo: quote.email, ...buildAdminEmail(quote) });
  if (clientAddress) messages.push({ to: clientAddress, ...(adminTo && { replyTo: adminTo }), ...buildClientEmail(quote) });
  const results = await Promise.allSettled(messages.map((message) => transport.sendMail({ from, ...message })));
  results.forEach((result, position) => {
    if (result.status === "rejected") console.error(`Falha ao enviar e-mail de orçamento para ${messages[position].to}.`, result.reason);
  });
}
