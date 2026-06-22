// =====================================================================
// One DSD vNext — render helpers (Layer 7)
// XSS-safe by construction: `esc` escapes interpolated values, and the
// `html` tagged template escapes every ${} unless wrapped in `raw()`.
// Pages are pure functions (viewModel) => string; no inline scripts or
// styles are ever emitted (the locked CSP forbids them).
// =====================================================================

export class SafeHtml {
  constructor(public readonly value: string) {}
}

/** Mark an already-safe HTML fragment so the `html` template won't re-escape. */
export function raw(s: string): SafeHtml {
  return new SafeHtml(s);
}

export function esc(input: unknown): string {
  const s = input === null || input === undefined ? "" : String(input);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Tagged template that escapes interpolations; arrays are joined. */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeHtml {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new SafeHtml(out);
}

function renderValue(v: unknown): string {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(renderValue).join("");
  return esc(v);
}

/** Attribute helper: returns ` name="value"` only when value is truthy. */
export function attr(name: string, value: unknown): SafeHtml {
  if (value === undefined || value === null || value === false) return raw("");
  if (value === true) return raw(` ${name}`);
  return raw(` ${name}="${esc(value)}"`);
}


/** In-place edit marker attrs (authority + edit mode). Empty when off. */
export function editMark(on: boolean, endpoint: string, field: string): SafeHtml {
  if (!on) return raw("");
  return raw(` data-editable data-edit-endpoint="${esc(endpoint)}" data-edit-field="${esc(field)}"`);
}
