// =====================================================================
// Tests for the page shell brand seam (multi-client adaptiveness).
// Default render is DSD; a passed brand or a startup-configured brand
// (from program_config) overrides it. No global state leaks between tests.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { page, setProgramBrand } from "./layout.js";
import { raw } from "./render.js";
import type { NavContext } from "./viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["staff"] }, active: "home" };
const body = raw("<p>hi</p>");

test("default brand is DSD", () => {
  const doc = page({ title: "Home", nav, body });
  assert.match(doc, /<title>Home · One DSD<\/title>/);
  assert.match(doc, /class="brand__name">One DSD</);
  assert.match(doc, /People, Access &amp; Culture/);
  assert.match(doc, /Disability Services Division/);
});

test("per-render brand overrides for another client (config-driven, no rebuild)", () => {
  const doc = page({
    title: "Home", nav, body,
    brand: { shortName: "Acme Belonging", sub: "Belonging at Acme", footer: "Acme — internal program." },
  });
  assert.match(doc, /<title>Home · Acme Belonging<\/title>/);
  assert.match(doc, /class="brand__name">Acme Belonging</);
  assert.match(doc, /Belonging at Acme/);
  assert.doesNotMatch(doc, /class="brand__name">One DSD</);
});

test("startup-configured brand applies to all pages, then resets cleanly", () => {
  try {
    setProgramBrand({ shortName: "Acme", sub: "Belonging", footer: "Acme footer." });
    const doc = page({ title: "Home", nav, body });
    assert.match(doc, /class="brand__name">Acme</);
    assert.match(doc, /Acme footer\./);
  } finally {
    setProgramBrand(null); // never leak into other tests
  }
  const back = page({ title: "Home", nav, body });
  assert.match(back, /class="brand__name">One DSD</); // default restored
});
