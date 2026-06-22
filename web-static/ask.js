// One DSD vNext — ask.js (Layer 9) — enhancement only.
// Posts the question to /api/ask and renders the cited result. Escapes all
// server data before insertion. Never renders anything the API didn't return.
(function () {
  "use strict";
  var form = document.querySelector("[data-ask]");
  var out = document.getElementById("ask-result");
  if (!form || !out) return;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render(r) {
    var html = '<p class="ask__framing">' + esc(r.message) + "</p>";
    if (r.answer) {
      html += '<div class="ask__answer">' +
        r.answer.split(/\n{2,}/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        "</div>";
    }
    if (r.citations && r.citations.length) {
      html += '<div class="ask__sources"><h2 class="ask__h2">Sources</h2><ul>' +
        r.citations.map(function (c) {
          return '<li><a href="/library/' + encodeURIComponent(c.assetId) + '">' + esc(c.title) + "</a></li>";
        }).join("") + "</ul></div>";
    }
    out.innerHTML = html;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = form.querySelector('[name="question"]').value.trim();
    if (!q) return;
    out.innerHTML = '<p class="muted">Searching the approved library…</p>';
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question: q }),
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(render)
      .catch(function () { out.innerHTML = '<p class="formerror" role="alert">Something went wrong. Please try again.</p>'; });
  });
})();
