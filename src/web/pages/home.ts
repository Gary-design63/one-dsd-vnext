// =====================================================================
// One DSD vNext — Home page (Layer 7) + in-place editing (authority).
// Photographic hero + IDC-calibrated journey doors. In edit mode the hero
// copy is editable in place (saved to site_copy, versioned + audited).
// =====================================================================
import { html, raw, editMark } from "../render.js";
import { page } from "../layout.js";
import { assetCard } from "./_cards.js";
import type { HomeView } from "../viewModels.js";

export function renderHome(v: HomeView): string {
  const ed = v.editMode === true;
  const eyebrow = v.heroEyebrow ?? "One DSD";
  const title = v.heroTitle ?? "People, Access & Culture";
  const lede = v.heroLede ?? "Find what you need, and grow where you choose. Start with a path that fits where you are today.";

  const greeting = v.greetingName
    ? html`<p class="hero__greeting">Welcome back, ${v.greetingName}.</p>`
    : raw("");

  const doors = v.doors.map(
    (d) => html`
      <li class="door">
        <a class="door__link" href="${d.href}">
          <span class="door__label">${d.label}</span>
          <span class="door__desc">${d.description}</span>
          ${d.idcStage ? html`<span class="door__tag">Calibrated for: ${d.idcStage}</span>` : raw("")}
        </a>
      </li>`,
  );

  const featured =
    v.featured.length > 0
      ? html`
        <section class="section" aria-labelledby="featured-h">
          <h2 id="featured-h" class="section__title">Featured in the Library</h2>
          <ul class="cardgrid">${v.featured.map((c) => assetCard(c, ed))}</ul>
        </section>`
      : raw("");

  const body = html`
    <section class="hero hero--banner" aria-labelledby="home-h">
      <img class="hero__img" src="/static/hero.jpg" alt="Disability Services Division staff collaborating around a table, with a map of Minnesota on the wall." />
      <div class="hero__panel">
        <span class="hero__eyebrow"${editMark(ed, "/api/edit/copy/home.hero.eyebrow", "value")}>${eyebrow}</span>
        <h1 id="home-h" class="hero__title"${editMark(ed, "/api/edit/copy/home.hero.title", "value")}>${title}</h1>
        ${greeting}
        <p class="hero__lede"${editMark(ed, "/api/edit/copy/home.hero.lede", "value")}>${lede}</p>
      </div>
    </section>
    <section class="section" aria-labelledby="doors-h">
      <h2 id="doors-h" class="section__title">Start here</h2>
      <ul class="doorgrid">${doors}</ul>
    </section>
    ${featured}`;

  return page({
    title: "Home",
    nav: { ...v.nav, editMode: ed },
    description: "One DSD — People, Access and Culture program.",
    body,
    editAllowed: ed,
  });
}
