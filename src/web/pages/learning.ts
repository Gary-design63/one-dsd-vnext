// =====================================================================
// One DSD vNext — Learning (index + path) (Layer 7)
// Paths show ordered modules with visible progress. Educational-psychology
// notes: the progress meter exploits the goal-gradient effect (motivation
// rises as the goal nears); module kinds beyond "read" (reflect/practice/
// assess) force retrieval and application, the durable forms of learning;
// proficiency band sets expectations and supports desirable difficulty.
// In edit mode (authority) the index heading + intro are editable copy.
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type {
  LearningIndexView,
  LearningPathView,
  LearningModuleVM,
} from "../viewModels.js";

const KIND_LABEL: Record<LearningModuleVM["kind"], string> = {
  read: "Read",
  watch: "Watch",
  listen: "Listen",
  reflect: "Reflect",
  practice: "Practice",
  assess: "Check understanding",
};

export function renderLearningIndex(v: LearningIndexView): string {
  const ed = v.editMode === true;
  const introTitle = copyText(v.copy, "learning.intro.title", "Learning paths");
  const introLede = copyText(v.copy, "learning.intro.lede", "Sequenced journeys that build from foundations to practice. Choose a path that fits where you are.");
  const cards = v.paths.map(
    (p) => html`
      <li class="card">
        <a class="card__link" href="/learning/${p.id}">
          <h3 class="card__title"${editMark(ed, `/api/edit/learning_path/${p.id}`, "title")}>${p.title}</h3>
          ${p.summary ? html`<p class="card__summary">${p.summary}</p>` : raw("")}
        </a>
        <p class="card__meta">
          ${p.proficiencyBand ? html`<span class="chip chip--band">${p.proficiencyBand}</span>` : raw("")}
          <span class="chip">${p.moduleCount} module${p.moduleCount === 1 ? "" : "s"}</span>
        </p>
      </li>`,
  );
  const body = html`
    <section aria-labelledby="learn-h">
      <h1 id="learn-h" class="section__title"${editMark(ed, "/api/edit/copy/learning.intro.title", "value")}>${introTitle}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/learning.intro.lede", "value")}>${introLede}</p>
      ${v.paths.length > 0
        ? html`<ul class="cardgrid">${cards}</ul>`
        : html`<p class="empty">No learning paths are published yet.</p>`}
    </section>`;
  return page({ title: "Learning", nav: { ...v.nav, editMode: ed }, body, description: "Sequenced learning paths.", editAllowed: ed });
}

function moduleRow(m: LearningModuleVM, ed = false): SafeHtml {
  const stateLabel =
    m.state === "completed" ? "Completed" : m.state === "in_progress" ? "In progress" : "Not started";
  return html`
    <li class="module module--${m.state}">
      <span class="module__ord" aria-hidden="true">${m.ordinal}</span>
      <span class="module__body">
        <span class="module__title"${editMark(ed, `/api/edit/learning_module/${m.id}`, "title")}>${m.title}</span>
        <span class="module__meta">
          <span class="chip chip--kind">${KIND_LABEL[m.kind]}</span>
          ${typeof m.estimatedMinutes === "number" ? html`<span class="chip chip--time">${m.estimatedMinutes} min</span>` : raw("")}
        </span>
      </span>
      <span class="module__state" data-state="${m.state}">${stateLabel}</span>
    </li>`;
}

export function renderLearningPath(v: LearningPathView): string {
  const ed = v.editMode === true;
  const total = v.modules.length;
  const pct = total === 0 ? 0 : Math.round((v.completedCount / total) * 100);
  const body = html`
    <article class="path">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/learning">Learning</a> <span aria-hidden="true">/</span> <span>${v.path.title}</span>
      </nav>
      <h1 class="path__title"${editMark(ed, `/api/edit/learning_path/${v.path.id}`, "title")}>${v.path.title}</h1>
      ${v.path.summary || ed ? html`<p class="path__summary"${editMark(ed, `/api/edit/learning_path/${v.path.id}`, "summary")}>${v.path.summary ?? ""}</p>` : raw("")}
      <div class="progress">
        <div class="progress__bar">
          <span class="progress__fill" data-pct="${pct}"></span>
        </div>
        <p class="progress__label" role="status">${v.completedCount} of ${total} complete (${pct}%)</p>
      </div>
      <ol class="modulelist">${v.modules.map((m) => moduleRow(m, ed))}</ol>
    </article>`;
  return page({ title: v.path.title, nav: { ...v.nav, editMode: ed }, body, scripts: ["/static/progress.js"], editAllowed: ed });
}
