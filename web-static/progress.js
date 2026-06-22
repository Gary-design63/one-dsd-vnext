// One DSD vNext — progress.js (Layer 7).
// CSP forbids inline styles, so the progress fill width is applied here
// from the data-pct attribute the server rendered.
(function () {
  "use strict";
  var fill = document.querySelector(".progress__fill[data-pct]");
  if (!fill) return;
  var pct = parseInt(fill.getAttribute("data-pct") || "0", 10);
  if (pct < 0) pct = 0; if (pct > 100) pct = 100;
  fill.style.width = pct + "%";
})();
