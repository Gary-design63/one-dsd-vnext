// One DSD vNext — reader.js (Layer 7) — UDL read-aloud.
// If an <audio> render exists it is the primary control (works without JS).
// This adds a speech-synthesis fallback so EVERY text asset can be heard.
(function () {
  "use strict";
  var wrap = document.querySelector("[data-reader]");
  if (!wrap) return;
  var btn = wrap.querySelector("[data-reader-toggle]");
  var hasAudio = !!wrap.querySelector("audio");
  var readable = document.querySelector("[data-readable]");
  if (!btn || !readable) return;

  // If a real audio render is present, defer to the native player.
  if (hasAudio) { btn.hidden = true; return; }

  if (!("speechSynthesis" in window)) { btn.hidden = true; return; }

  var speaking = false;
  function stop() {
    window.speechSynthesis.cancel();
    speaking = false;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "Audio";
  }
  function start() {
    var text = readable.textContent || "";
    if (!text.trim()) return;
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.lang = "en-US";
    u.onend = stop; u.onerror = stop;
    window.speechSynthesis.speak(u);
    speaking = true;
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "Stop";
  }
  btn.addEventListener("click", function () { speaking ? stop() : start(); });
  window.addEventListener("beforeunload", stop);
})();
