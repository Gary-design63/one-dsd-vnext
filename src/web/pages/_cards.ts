// =====================================================================
// One DSD vNext — shared card components (Layer 7)
// One asset card, used by Home and Library. Educational-psychology note:
// each card states what the item IS (format), how demanding it is
// (proficiency band) and how long it takes (estimated minutes) — explicit
// metacognitive cues that let staff self-regulate and pick deliberately.
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import type { AssetCard } from "../viewModels.js";

const FORMAT_LABEL: Record<string, string> = {
  resource: "Resource",
  brief: "Brief",
  scenario: "Scenario",
  guide: "Guide",
  tool: "Tool",
  reference: "Reference",
};

const BAND_LABEL: Record<string, string> = {
  emerging: "Emerging",
  applied: "Applied",
  advanced: "Advanced",
};

export function assetCard(a: AssetCard, editMode = false): SafeHtml {
  const meta: SafeHtml[] = [];
  if (a.format) meta.push(html`<span class="chip chip--format">${FORMAT_LABEL[a.format] ?? a.format}</span>`);
  if (a.proficiencyBand) meta.push(html`<span class="chip chip--band">${BAND_LABEL[a.proficiencyBand] ?? a.proficiencyBand}</span>`);
  if (typeof a.estimatedMinutes === "number") meta.push(html`<span class="chip chip--time">${a.estimatedMinutes} min</span>`);
  if (a.hasAudio) meta.push(html`<span class="chip chip--audio">Audio</span>`);

  return html`
    <li class="card">
      <a class="card__link" href="/library/${a.id}">
        <h3 class="card__title"${editMark(editMode, `/api/edit/asset/${a.id}`, "title")}>${a.title}</h3>
        ${a.summary ? html`<p class="card__summary">${a.summary}</p>` : raw("")}
      </a>
      ${meta.length > 0 ? html`<p class="card__meta">${meta}</p>` : raw("")}
    </li>`;
}
