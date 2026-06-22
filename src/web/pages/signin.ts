// =====================================================================
// One DSD vNext — Sign-in page (Layer 7)
// Minimal, accessible form. Posts to /api/auth/login (same-origin). Error
// text is announced via role="alert". No user enumeration in copy.
// =====================================================================
import { html, raw } from "../render.js";
import { page } from "../layout.js";
import type { SignInView } from "../viewModels.js";

export function renderSignIn(v: SignInView): string {
  const error = v.error
    ? html`<p class="formerror" role="alert">${v.error}</p>`
    : raw("");
  const body = html`
    <section class="authwrap" aria-labelledby="signin-h">
      <h1 id="signin-h" class="section__title">Sign in</h1>
      ${error}
      <form class="authform" method="post" action="/sign-in">
        ${v.returnTo ? html`<input type="hidden" name="returnTo" value="${v.returnTo}" />` : raw("")}
        <div class="field">
          <label for="identifier">Username or email</label>
          <input id="identifier" name="identifier" type="text" autocomplete="username" required autocapitalize="none" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn btn--primary">Sign in</button>
      </form>
    </section>`;
  return page({ title: "Sign in", nav: { viewer: null }, body });
}

