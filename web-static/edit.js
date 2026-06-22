// One DSD vNext — edit.js — in-place editing (authority only).
// Activates ONLY when the server marked the page <body data-edit-allowed>
// (consultant/admin + edit mode). Makes [data-editable] regions editable and
// saves to the governed, versioned, audited endpoint. Enhancement-only.
(function () {
  "use strict";
  if (!document.body.hasAttribute("data-edit-allowed")) return;
  var els = Array.prototype.slice.call(document.querySelectorAll("[data-editable]"));
  if (!els.length) return;

  var dirty = new Set();
  var bar = document.createElement("div"); bar.className = "editsave"; bar.hidden = true;
  var status = document.createElement("span"); status.className = "editsave__status";
  var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn--primary"; btn.textContent = "Save changes";
  bar.appendChild(status); bar.appendChild(btn); document.body.appendChild(bar);

  els.forEach(function (el) {
    el.setAttribute("contenteditable", "true");
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", "Editable: " + (el.getAttribute("data-edit-field") || "content"));
    el.classList.add("is-editable");
    el.addEventListener("input", function () {
      dirty.add(el); bar.hidden = false;
      status.textContent = dirty.size + " unsaved change" + (dirty.size === 1 ? "" : "s");
    });
  });

  btn.addEventListener("click", function () {
    if (dirty.size === 0) return;
    btn.disabled = true; status.textContent = "Saving…";
    var groups = {};      // entity endpoints -> {field: value}
    var copies = [];      // page-copy endpoints -> single value
    dirty.forEach(function (el) {
      var ep = el.getAttribute("data-edit-endpoint");
      var f = el.getAttribute("data-edit-field");
      if (ep.indexOf("/api/edit/copy/") !== -1) {
        copies.push({ ep: ep, value: el.innerText.trim() });
      } else {
        (groups[ep] = groups[ep] || {})[f] = el.innerText.trim();
      }
    });
    var posts = Object.keys(groups).map(function (ep) {
      return fetch(ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: groups[ep] }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
    }).concat(copies.map(function (c) {
      return fetch(c.ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: c.value }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
    }));
    Promise.all(posts).then(function () {
      dirty.clear(); status.textContent = "Saved."; btn.disabled = false;
      setTimeout(function () { bar.hidden = true; }, 1500);
    }).catch(function () { status.textContent = "Save failed — try again."; btn.disabled = false; });
  });
})();
