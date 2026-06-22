// One DSD vNext — library.js (Layer 7) — enhancement only.
// The filter form works without JS (GET submit). This adds instant,
// no-reload filtering via the JSON API when JS is available.
(function () {
  "use strict";
  var form = document.querySelector(".library__facets");
  var results = document.getElementById("results");
  var countEl = document.querySelector(".library__count");
  if (!form || !results) return;

  function buildQuery() {
    var data = new FormData(form);
    var params = new URLSearchParams();
    var q = data.get("q");
    if (q) params.set("q", String(q));
    data.getAll("cluster").forEach(function (v) { params.append("cluster", String(v)); });
    data.getAll("format").forEach(function (v) { params.append("format", String(v)); });
    data.getAll("proficiency").forEach(function (v) { params.append("proficiency", String(v)); });
    return params;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function card(a) {
    var chips = "";
    if (a.format) chips += '<span class="chip chip--format">' + escapeHtml(a.format) + "</span>";
    if (a.proficiencyBand) chips += '<span class="chip chip--band">' + escapeHtml(a.proficiencyBand) + "</span>";
    return '<li class="card"><a class="card__link" href="/library/' + encodeURIComponent(a.id) + '">' +
      '<h3 class="card__title">' + escapeHtml(a.title) + "</h3>" +
      (a.summary ? '<p class="card__summary">' + escapeHtml(a.summary) + "</p>" : "") +
      "</a>" + (chips ? '<p class="card__meta">' + chips + "</p>" : "") + "</li>";
  }

  var timer = null;
  function refresh() {
    var params = buildQuery();
    fetch("/api/library?" + params.toString(), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var items = data.items || [];
        if (items.length === 0) {
          results.outerHTML = '<p class="empty" id="results">No items match these filters yet. Try removing a filter.</p>';
        } else {
          var ul = '<ul class="cardgrid" id="results">' + items.map(card).join("") + "</ul>";
          results.outerHTML = ul;
        }
        results = document.getElementById("results");
        if (countEl && typeof data.total === "number") {
          countEl.textContent = data.total + (data.total === 1 ? " item" : " items");
        }
      })
      .catch(function () { /* keep server-rendered results on error */ });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); refresh(); });
  form.addEventListener("change", function () { clearTimeout(timer); timer = setTimeout(refresh, 150); });
  var search = form.querySelector('input[name="q"]');
  if (search) search.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(refresh, 300); });
})();
