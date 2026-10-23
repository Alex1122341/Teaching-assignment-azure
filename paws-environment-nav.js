(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  // Shared environment switcher for every PAWS page.
  //
  // * The environment shown is the one this deployment was BUILT for (paws-api-origin.js) and is
  //   cross-checked against the environment the API reports in /api/v1/me. A mismatch locks the page.
  // * Switching environments is plain navigation to the other, separately deployed site. Only an
  //   allow-listed page path is carried over: never a token, query string or hash. The other site
  //   uses its own Firebase project, so the user signs in there separately.
  // * Testing identity switching is offered only when the SERVER reports environment=testing; the
  //   persona itself is resolved and enforced server-side (Developer Support adapter).

  const PAGES = Object.freeze(['index.html', 'faculty-admin.html', 'teaching-assignments.html', 'user-management.html']);
  const OPERATOR_ROLES = Object.freeze(['developer', 'adfa_general', 'adfa_regular', 'owner', 'administrator', 'admin']);
  const ROLE_LABELS = Object.freeze({
    developer: 'Developer', adfa_general: 'ADFAD Owner / General', adfa_regular: 'ADFAD Administrator', owner: 'ADFAD Owner / General',
    administrator: 'ADFAD Administrator', admin: 'ADFAD Administrator', faculty: 'Faculty', hicc: 'HICC', visc: 'VISC', adc: 'ADC office', lab: 'LAB office'
  });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const roleLabel = role => ROLE_LABELS[String(role || '').toLowerCase()] || String(role || 'Unknown role');

  function isOperator(role) { return OPERATOR_ROLES.includes(String(role || '').toLowerCase()); }

  // Destination on the peer site: same page when it is a known PAWS page, otherwise the home page.
  function peerDestination(config, pathname) {
    if (!config || !config.peerSiteUrl) return null;
    const page = String(pathname || '').split('/').pop();
    const target = new URL(config.peerSiteUrl);
    target.pathname = PAGES.includes(page) ? '/' + page : '/';
    return target.origin + target.pathname;
  }

  // Pure view model, unit-tested without a DOM.
  function viewModel(config, me, { now = Date.now(), expired = false } = {}) {
    const built = config && config.environment;
    const reported = me && me.environment && me.environment.name;
    const profile = me && me.profile;
    const support = me && me.support;
    if (!built) return { state: 'misconfigured', message: 'This site has no environment configuration.' };
    if (reported && reported !== built) {
      return { state: 'mismatch', message: `This ${built} site is connected to a ${reported} API. Access is blocked.` };
    }
    const testing = built === 'testing';
    const actorRole = support ? support.actorRole : profile && profile.role;
    const operator = isOperator(actorRole);
    return {
      state: 'ok',
      testing,
      label: config.environmentLabel || (testing ? 'TESTING ENVIRONMENT — SYNTHETIC DATA ONLY' : 'Production'),
      showBar: testing || (operator && Boolean(config.peerSiteUrl)),
      openTesting: !testing && operator && Boolean(config.peerSiteUrl),
      returnToProduction: testing && Boolean(config.peerSiteUrl),
      switchIdentity: testing && reported === 'testing' && operator,
      actor: support ? { name: support.actorName, role: support.actorRole } : profile ? { name: profile.displayName, role: profile.role } : null,
      persona: support ? { name: support.targetName, role: support.targetRole, expiresAtUtc: support.expiresAtUtc } : null,
      // The persona session ended: on its own timer, or because the server rejected it.
      personaExpired: Boolean(support) && (expired || (Boolean(support.expiresAtUtc) && Date.parse(support.expiresAtUtc) <= now)),
      scope: support ? null : profile && profile.facultyId ? 'Own Faculty record' : null
    };
  }

  const STYLE = `
.paws-env-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:8px 20px;font:600 13px/1.4 Inter,"Segoe UI",Arial,sans-serif;position:relative;z-index:13;border-bottom:1px solid #dce3ec;background:#f7f9fc;color:#142443}
.paws-env-bar[hidden]{display:none!important}
.paws-env-bar.is-testing{background:#b3261e;color:#fff;border-bottom:3px solid #ffcd00}
.paws-env-bar.is-blocked{background:#5c0011;color:#fff}
.paws-env-badge{letter-spacing:.06em;text-transform:uppercase;font-weight:800}
.paws-env-who{font-weight:500;flex:1 1 260px;min-width:0}
.paws-env-who strong{font-weight:700}
.paws-env-actions{display:flex;flex-wrap:wrap;gap:8px}
.paws-env-bar button,.paws-env-bar a.paws-env-link{font:600 13px/1 Inter,"Segoe UI",Arial,sans-serif;border-radius:5px;padding:8px 12px;cursor:pointer;text-decoration:none;border:1px solid currentColor;background:transparent;color:inherit;white-space:nowrap}
.paws-env-bar.is-testing button,.paws-env-bar.is-testing a.paws-env-link{background:#fff;color:#7a1712;border-color:#fff}
.paws-env-bar button:focus-visible,.paws-env-bar a:focus-visible{outline:3px solid #ffcd00;outline-offset:2px}
@media(max-width:640px){.paws-env-bar{padding:8px 12px}.paws-env-actions{width:100%}.paws-env-actions>*{flex:1 1 auto;text-align:center}}
body.paws-env-locked main,body.paws-env-locked .main-view,body.paws-env-locked .faculty-admin-page{pointer-events:none;opacity:.35}`;

  function install(win) {
    const doc = win.document;
    const config = win.PAWS_ENVIRONMENT_CONFIG || win.PAWS_API_ORIGIN_CONFIG || null;
    let lastMe = null, expired = false, expiryTimer = null;

    function bar() {
      let el = doc.getElementById('paws-environment-bar');
      if (!el) {
        if (!doc.getElementById('paws-environment-style')) {
          const style = doc.createElement('style'); style.id = 'paws-environment-style'; style.textContent = STYLE; doc.head.append(style);
        }
        el = doc.createElement('div'); el.id = 'paws-environment-bar'; el.className = 'paws-env-bar'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Environment');
        doc.body.prepend(el);
      }
      return el;
    }

    function render() {
      const model = viewModel(config, lastMe, { expired });
      if (expiryTimer) { win.clearTimeout(expiryTimer); expiryTimer = null; }
      if (model.persona && !model.personaExpired && model.persona.expiresAtUtc) {
        const wait = Date.parse(model.persona.expiresAtUtc) - Date.now();
        if (wait > 0 && wait <= 31 * 60 * 1000) expiryTimer = win.setTimeout(render, wait + 1000);
      }
      const el = bar();
      if (model.state !== 'ok') {
        el.hidden = false; el.className = 'paws-env-bar is-blocked';
        el.innerHTML = `<span class="paws-env-badge">Environment error</span><span class="paws-env-who">${esc(model.message)}</span>`;
        doc.body.classList.add('paws-env-locked');
        return;
      }
      doc.body.classList.toggle('paws-env-testing', model.testing);
      el.hidden = !model.showBar;
      el.className = 'paws-env-bar' + (model.testing ? ' is-testing' : '');
      const who = model.actor
        ? `Signed in as <strong>${esc(model.actor.name)}</strong> (${esc(roleLabel(model.actor.role))})` +
          (model.persona && model.personaExpired ? ` · <strong>Test identity session expired</strong> (was ${esc(model.persona.name)}). Return to yourself to continue.` : '') +
          (model.persona && !model.personaExpired ? ` · Testing as <strong>${esc(model.persona.name)}</strong> — effective role <strong>${esc(roleLabel(model.persona.role))}</strong>` +
            (model.persona.expiresAtUtc ? ` · session ends ${esc(new Date(model.persona.expiresAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}` : '') : '')
        : (model.testing ? 'Synthetic test data only · sign in with your Testing account' : '');
      const dest = peerDestination(config, win.location.pathname);
      el.innerHTML = `<span class="paws-env-badge">${esc(model.label)}</span><span class="paws-env-who">${who}</span><span class="paws-env-actions">` +
        (model.openTesting ? `<a class="paws-env-link" data-env-open href="${esc(dest)}">Open Testing Environment</a>` : '') +
        (model.returnToProduction ? `<a class="paws-env-link" data-env-return href="${esc(dest)}">Return to Production</a>` : '') +
        (model.switchIdentity && !model.personaExpired ? `<button type="button" data-env-switch>${model.persona ? 'Change Test Identity' : 'Switch Test Identity'}</button>` : '') +
        (model.persona ? `<button type="button" data-env-self>Return to myself</button>` : '') + '</span>';
      el.querySelector('[data-env-switch]')?.addEventListener('click', () => win.PAWS_SUPPORT && win.PAWS_SUPPORT.open());
      el.querySelector('[data-env-self]')?.addEventListener('click', () => (win.PAWS_SUPPORT ? win.PAWS_SUPPORT.leave() : win.location.reload()));
    }

    win.addEventListener('paws-profile', event => { lastMe = event.detail || null; expired = false; render(); });
    win.addEventListener('paws-support-expired', () => { expired = true; render(); });
    // Pages without the SQL data client (account/password pages) still show who is signed in.
    win.addEventListener('load', () => {
      try {
        if (!win.firebase || !win.firebase.apps || !win.firebase.apps.length) return;
        win.firebase.auth().onAuthStateChanged(user => {
          if (lastMe && lastMe.profile) return;
          lastMe = user ? { profile: { displayName: user.email || user.phoneNumber || 'Signed-in user', role: null } } : null;
          render();
        });
      } catch (_) { /* identity display only; never affects authorization */ }
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render); else render();
  }

  return Object.freeze({ install, viewModel, peerDestination, isOperator, PAGES });
});
