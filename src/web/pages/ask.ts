// =====================================================================
// One DSD vNext — Professional Support (Ask) page (Layer 9).
// Human framing only; no system jargon, no "AI". Answers come from the
// approved library with sources; weak/empty results are handled honestly.
// The form posts to /api/ask via ask.js (enhancement); a <noscript> note
// covers the no-JS case. In edit mode (authority) the heading + intro are
// editable copy.
// =====================================================================
import { html, raw, editMark } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type { NavContext } from "../viewModels.js";

export interface AskOpts { editMode?: boolean; copy?: Record<string, string>; }

export function renderAsk(nav: NavContext, opts: AskOpts = {}): string {
  const ed = opts.editMode === true;
  const title = copyText(opts.copy, "ask.intro.title", "Professional Support");
  const lede = copyText(opts.copy, "ask.intro.lede", "Ask a question and get guidance drawn from the approved One DSD library, with sources. If the library does not cover it, you will be told plainly — nothing is made up.");
  const body = html`
    <section class="ask" aria-labelledby="ask-h">
      <h1 id="ask-h" class="section__title"${editMark(ed, "/api/edit/copy/ask.intro.title", "value")}>${title}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/ask.intro.lede", "value")}>${lede}</p>
      <form class="ask__form" method="post" action="/ask" data-ask>
        <div class="field">
          <label for="q">Your question</label>
          <textarea id="q" name="question" rows="3" required placeholder="e.g. How should I approach an accommodation request during an assessment?"></textarea>
        </div>
        <button type="submit" class="btn btn--primary">Get guidance</button>
        <noscript><p class="muted">This works best with JavaScript on; your question will still be submitted.</p></noscript>
      </form>
      <section id="ask-result" class="ask__result" aria-live="polite"></section>
    </section>`;
  return page({
    title: "Professional Support",
    nav: { ...nav, active: "ask", editMode: ed },
    body,
    scripts: ["/static/ask.js"],
    editAllowed: ed,
    description: "Get guidance from the approved One DSD library, with sources.",
  });
}

import type { AskResult } from "../../ask/types.js";

/** No-JS fallback: server-rendered result page. */
export function renderAskResult(nav: NavContext, question: string, r: AskResult): string {
  const answer = r.answer
    ? html`<div class="ask__answer">${r.answer.split(/\n{2,}/).map((p) => html`<p>${p}</p>`)}</div>`
    : raw("");
  const sources = r.citations.length > 0
    ? html`<div class="ask__sources"><h2 class="ask__h2">Sources</h2><ul>${r.citations.map(
        (c) => html`<li><a href="/library/${c.assetId}">${c.title}</a></li>`,
      )}</ul></div>`
    : raw("");
  const body = html`
    <section class="ask" aria-labelledby="ask-h">
      <h1 id="ask-h" class="section__title">Professional Support</h1>
      <p class="ask__question"><strong>You asked:</strong> ${question}</p>
      <section class="ask__result" aria-live="polite">
        <p class="ask__framing">${r.message}</p>
        ${answer}
        ${sources}
      </section>
      <p><a class="btn btn--secondary" href="/ask">Ask another</a></p>
    </section>`;
  return page({ title: "Professional Support", nav: { ...nav, active: "ask" }, body });
}
