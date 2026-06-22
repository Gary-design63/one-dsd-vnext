// =====================================================================
// One DSD vNext — Audio & Podcast (staff surface).
// Lists approved, staff-visible episodes with a native <audio> player when
// a render is ready. No system jargon, no "AI" — it is "Audio"/"Podcast".
// In edit mode (authority) the heading + intro and each episode's
// title/summary are editable in place (versioned, audited, roll-back).
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type { AudioView, AudioEpisodeVM } from "../viewModels.js";

function episode(e: AudioEpisodeVM, ed: boolean): SafeHtml {
  const endpoint = `/api/edit/podcast_episode/${e.id}`;
  const tag = [
    typeof e.seasonNo === "number" ? `Season ${e.seasonNo}` : null,
    typeof e.episodeNo === "number" ? `Episode ${e.episodeNo}` : null,
    typeof e.durationMin === "number" ? `${e.durationMin} min` : null,
  ].filter(Boolean).join(" · ");
  const player = e.audioUrl
    ? html`<audio class="reader__audio" controls preload="none" src="/media/audio/${e.id}"></audio>`
    : html`<p class="muted">Audio for this episode is being prepared.</p>`;
  return html`
    <li class="card audiocard">
      <h2 class="card__title"${editMark(ed, endpoint, "title")}>${e.title}</h2>
      ${tag ? html`<p class="card__meta"><span class="chip">${tag}</span></p>` : raw("")}
      ${e.summary || ed ? html`<p class="card__summary"${editMark(ed, endpoint, "summary")}>${e.summary ?? ""}</p>` : raw("")}
      ${player}
    </li>`;
}

export function renderAudio(v: AudioView): string {
  const ed = v.editMode === true;
  const title = copyText(v.copy, "audio.intro.title", "Audio & Podcast");
  const lede = copyText(v.copy, "audio.intro.lede", "Listen on your own time. Episodes and narrated pieces drawn from the approved library.");
  const body = html`
    <section aria-labelledby="audio-h">
      <h1 id="audio-h" class="section__title"${editMark(ed, "/api/edit/copy/audio.intro.title", "value")}>${title}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/audio.intro.lede", "value")}>${lede}</p>
      ${v.episodes.length > 0
        ? html`<ul class="cardgrid">${v.episodes.map((e) => episode(e, ed))}</ul>`
        : html`<p class="empty">No episodes are published yet. New audio will appear here as it is released.</p>`}
    </section>`;
  return page({
    title: "Audio & Podcast",
    nav: { ...v.nav, active: "audio", editMode: ed },
    body,
    editAllowed: ed,
    description: "Listen to One DSD audio and podcast episodes.",
  });
}
