// =====================================================================
// One DSD vNext — page shell (Layer 7)
// Semantic, accessible layout: <html lang>, skip link, header/nav/main/
// footer landmarks, role-aware navigation. No inline script/style (CSP).
// Educational-psychology note: consistent, predictable chrome lowers
// extraneous cognitive load so attention goes to the content, not the UI.
// =====================================================================
import { html, raw, esc, type SafeHtml } from "./render.js";
import { assetUrl } from "./assets.js";
import type { NavContext } from "./viewModels.js";

const NAV_ITEMS: { key: NonNullable<NavContext["active"]>; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "library", label: "Library", href: "/library" },
  { key: "learning", label: "Learning", href: "/learning" },
  { key: "audio", label: "Audio", href: "/audio" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
  { key: "surveys", label: "Surveys", href: "/surveys" },
  { key: "growth", label: "Your Growth", href: "/growth" },
  { key: "ask", label: "Professional Support", href: "/ask" },
];

function nav(ctx: NavContext): SafeHtml {
  const signedIn = ctx.viewer !== null;
  const isConsultant =
    ctx.viewer?.roles.includes("consultant") ||
    ctx.viewer?.roles.includes("admin");
  const links = NAV_ITEMS.map((item) => {
    const current = ctx.active === item.key;
    return html`<li>
      <a href="${item.href}"${current ? raw(' aria-current="page" class="nav__link nav__link--active"') : raw(' class="nav__link"')}>${item.label}</a>
    </li>`;
  });
  if (isConsultant) {
    links.push(
      html`<li><a href="/console" class="nav__link${ctx.active === "console" ? " nav__link--active" : ""}">Console</a></li>`,
    );
  }
  return html`
    <nav class="nav" aria-label="Primary">
      <ul class="nav__list">${links}</ul>
      <div class="nav__account">
        ${isConsultant
          ? html`<a class="btn btn--ghost nav__edit" href="${ctx.editMode ? raw("?") : raw("?edit=1")}">${ctx.editMode ? "Done editing" : "Edit page"}</a>`
          : raw("")}
        ${signedIn
          ? html`<form method="post" action="/sign-out" class="nav__form"><button type="submit" class="btn btn--ghost">Sign out</button></form>`
          : html`<a href="/sign-in" class="btn btn--ghost">Sign in</a>`}
      </div>
    </nav>`;
}

export interface LayoutOptions {
  title: string;
  nav: NavContext;
  /** main content (already-safe HTML) */
  body: SafeHtml;
  /** optional client enhancement scripts (served from /static) */
  scripts?: string[];
  /** page description for assistive tech / SEO */
  description?: string;
  /** authority + edit mode: enable in-place editing on this render */
  editAllowed?: boolean;
  /** optional brand identity (multi-client; from program_config). Defaults to DSD. */
  brand?: { shortName?: string; sub?: string; footer?: string };
}

let configuredBrand: { shortName?: string; sub?: string; footer?: string } | null = null;

/** Set the active instance brand once at startup (from program_config). */
export function setProgramBrand(b: { shortName?: string; sub?: string; footer?: string } | null): void {
  configuredBrand = b;
}

export function page(opts: LayoutOptions): string {
  const b = opts.brand ?? configuredBrand ?? undefined;
  const brandName = b?.shortName && b.shortName.length > 0 ? b.shortName : "One DSD";
  const brandSub = b?.sub && b.sub.length > 0 ? b.sub : "People, Access & Culture";
  const brandFooter = b?.footer && b.footer.length > 0 ? b.footer : "One DSD — Disability Services Division. Internal program surface.";
  const scriptList = [...(opts.scripts ?? [])];
  if (opts.editAllowed) scriptList.push("/static/edit.js");
  const scripts = scriptList.map(
    (src) => html`<script src="${assetUrl(src)}" defer></script>`,
  );
  const doc = html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title} · ${brandName}</title>
  ${opts.description ? html`<meta name="description" content="${opts.description}" />` : raw("")}
  <link rel="stylesheet" href="${assetUrl("app.css")}" />
</head>
<body${opts.editAllowed ? raw(" data-edit-allowed") : raw("")}>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header class="masthead" role="banner">
    <div class="masthead__inner">
      <a href="/" class="brand" aria-label="${brandName} home">
        <span class="brand__rule" aria-hidden="true"></span>
        <span class="brand__name">${brandName}</span>
        <span class="brand__sub">${brandSub}</span>
      </a>
      ${nav(opts.nav)}
    </div>
  </header>
  <main id="main" class="main" role="main">
    ${opts.body}
  </main>
  <footer class="footsite" role="contentinfo">
    <p>${brandFooter}</p>
    <p class="footsite__humility">Shared to inform, never to perform. We defer to community voice.</p>
  </footer>
  ${scripts}
</body>
</html>`;
  return doc.value;
}
