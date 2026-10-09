// views.js — server-rendered HTML for larpstore.app.
// Pure string templates (no template engine). Everything user-derived is
// escaped. App icons are generated inline as SVG squircles (no binary assets).

import config from "./config.js";
import { CATEGORIES, formatPrice } from "./catalog.js";

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Darken a hex color by mixing toward black. */
function darken(hex, amt = 0.4) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const d = (c) => Math.max(0, Math.round(c * (1 - amt)));
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

/** Generate a squircle app icon as inline SVG. */
export function appIcon(app, size = 72) {
  const id = "g_" + app.slug;
  const grad = `${app.accent}`;
  const grad2 = darken(app.accent, 0.45);
  const glyphSize = Math.round(size * 0.52);
  return `<svg class="app-icon" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(
    app.name
  )} icon" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${grad}"/>
      <stop offset="1" stop-color="${grad2}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(
    size * 0.223
  )}" fill="url(#${id})"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(
    size * 0.223
  )}" fill="none" stroke="rgba(255,255,255,0.14)"/>
  <text x="50%" y="52%" dominant-baseline="central" text-anchor="middle"
        font-size="${glyphSize}" fill="rgba(255,255,255,0.95)"
        font-family="Bricolage Grotesque, Inter, sans-serif" font-weight="700">${escapeHtml(
          app.glyph || app.name[0]
        )}</text>
</svg>`;
}

function googleG() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
}

/** Nav auth area: signed-in avatar menu, or Google sign-in button. */
function navAuth(ctx) {
  if (ctx.user) {
    const u = ctx.user;
    const av = u.picture
      ? `<img class="avatar" src="${escapeHtml(u.picture)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar fallback">${escapeHtml(initials(u.name, u.email))}</span>`;
    return `<a class="nav-link ${ctx.path === "/library" ? "active" : ""}" href="/library">Library</a>
      <span class="who">${av}<span class="name">${escapeHtml(u.name || u.email || "You")}</span></span>
      <a class="btn btn-ghost" href="/auth/logout">Sign out</a>`;
  }
  const label = config.google.configured ? "Sign in with Google" : "Sign in";
  return `<a class="btn btn-google" href="/auth/google?next=${encodeURIComponent(
    ctx.path || "/"
  )}">${googleG()} ${label}</a>`;
}

export function layout(ctx, body) {
  const title = ctx.title ? `${ctx.title} — larpstore` : "larpstore";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="description" content="larpstore — a boutique app store for larped apps. Featuring Exodus.">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;550;600;650&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="nav">
  <div class="container nav-inner">
    <a class="brand" href="/"><span class="mark">◆</span>larp<span class="dim">store</span></a>
    <a class="nav-link ${ctx.path === "/" ? "active" : ""}" href="/">Discover</a>
    <span class="nav-spacer"></span>
    ${navAuth(ctx)}
  </div>
</header>
<main class="container">
${body}
</main>
<footer class="footer">
  <div class="container row">
    <span>larpstore.app — built for larped apps.</span>
    <span><a href="/">Discover</a> &nbsp;·&nbsp; <a href="/library">Library</a> &nbsp;·&nbsp; <a href="/app/exodus">Exodus</a></span>
  </div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

/* ----------------------------- Home ----------------------------- */
export function homePage(ctx, { featured, apps, ownsFeatured }) {
  const monthly = featured.tiers.find((t) => t.id === "monthly");
  const lifetime = featured.tiers.find((t) => t.id === "lifetime");

  const heroActions = ownsFeatured
    ? `<a class="btn btn-primary btn-lg" href="/library">Open in Library</a>
       <a class="btn btn-ghost btn-lg" href="/app/${featured.slug}">View page</a>`
    : `<a class="btn btn-primary btn-lg" href="/app/${featured.slug}">Get ${escapeHtml(
        featured.name
      )}</a>
       <a class="btn btn-ghost btn-lg" href="/app/${featured.slug}">
         <span class="price-inline">${formatPrice(lifetime.priceCents)}</span>&nbsp;lifetime · ${formatPrice(
        monthly.priceCents
      )}/mo</a>`;

  const cards = apps
    .map((a) => appCard(a, ctx))
    .join("\n");

  return layout(
    { ...ctx, title: null },
    `
<section class="hero">
  <div class="hero-card reveal">
    <div class="hero-icon reveal d1">${appIcon(featured, 128)}</div>
    <div class="hero-main">
      <p class="hero-eyebrow">Featured on larpstore</p>
      <h1>${escapeHtml(featured.name)}</h1>
      <p class="tagline">${escapeHtml(featured.tagline)}</p>
      <div class="chips">
        <span class="chip star">★ ${featured.rating.toFixed(1)}</span>
        <span class="chip">${escapeHtml(catName(featured.category))}</span>
        <span class="chip">${escapeHtml(featured.ageRating)}</span>
        ${ownsFeatured ? `<span class="chip owned">✓ In your Library</span>` : ``}
      </div>
      <div class="hero-actions">${heroActions}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>All apps</h2>
    <span class="sub">${apps.length} in the store</span>
  </div>
  <div class="grid">
    ${cards}
  </div>
</section>
`
  );
}

function catName(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.name : id;
}

function appCard(a, ctx) {
  if (a.comingSoon) {
    return `<div class="app-card soon">
      ${appIcon(a, 56)}
      <div class="meta">
        <div class="name">${escapeHtml(a.name)}</div>
        <p class="tg">${escapeHtml(a.tagline)}</p>
        <div class="row">
          <span class="cat">${escapeHtml(catName(a.category))}</span>
          <span class="chip soon">Soon</span>
        </div>
      </div>
    </div>`;
  }
  const owns = ctx.ownedSlugs && ctx.ownedSlugs.has(a.slug);
  const action = owns
    ? `<span class="chip owned">✓ Owned</span>`
    : `<span class="btn btn-ghost" aria-hidden="true">Get</span>`;
  return `<a class="app-card stretch-link" href="/app/${a.slug}">
    ${appIcon(a, 56)}
    <div class="meta">
      <div class="name">${escapeHtml(a.name)}</div>
      <p class="tg">${escapeHtml(a.tagline)}</p>
      <div class="row">
        <span class="cat">${escapeHtml(catName(a.category))}</span>
        ${action}
      </div>
    </div>
  </a>`;
}

/* ----------------------------- App detail ----------------------------- */
export function appPage(ctx, { app, owns, entitlement, csrf, flash }) {
  const shots = app.screenshots
    .map(
      (s) => `<div class="shot" style="background:linear-gradient(160deg, hsl(${s.hue} 70% 32%), hsl(${
        s.hue + 24
      } 65% 18%))"><span class="frame"></span>${escapeHtml(s.title)}</div>`
    )
    .join("\n");

  const included = app.highlights
    .map(
      (h) => `<li><span class="tick">✓</span><span>${escapeHtml(h)}</span></li>`
    )
    .join("\n");

  let purchaseBlock;
  if (owns) {
    const status = entitlement.lifetime
      ? `<span class="status-pill life">Lifetime</span>`
      : `<span class="status-pill active">Active until ${fmtDate(
          entitlement.expires_at
        )}</span>`;
    purchaseBlock = `
<div class="owned-panel">
  <div style="font-size:26px">✓</div>
  <div class="txt">
    <div><strong>${escapeHtml(app.name)} is in your Library.</strong></div>
    <div style="color:var(--muted);font-size:14px">You own this ${status.includes(
      "Lifetime"
    )
      ? "forever"
      : "plan"}. ${status}</div>
  </div>
  <a class="btn btn-primary btn-lg" href="/library">Open in Library</a>
</div>`;
  } else {
    purchaseBlock = `<div class="tiers">${app.tiers
      .map((t) => tierCard(app, t, csrf))
      .join("\n")}</div>`;
  }

  const flashHtml = flash
    ? `<div class="notice ${flash.kind}">${escapeHtml(flash.msg)}</div>`
    : "";

  return layout(
    { ...ctx, title: app.name },
    `
<a class="back" href="/">‹ Discover</a>
${flashHtml}
<div class="detail-head reveal">
  ${appIcon(app, 104)}
  <div>
    <h1 class="title">${escapeHtml(app.name)}</h1>
    <div class="dev">${escapeHtml(app.developer)}</div>
    <div class="chips">
      <span class="chip star">★ ${app.rating.toFixed(1)}</span>
      <span class="chip">${formatRatingCount(app.ratingCount)} ratings</span>
      <span class="chip">${escapeHtml(catName(app.category))}</span>
      <span class="chip">${escapeHtml(app.ageRating)}</span>
    </div>
  </div>
</div>

${
  ctx.user
    ? ""
    : `<div class="notice info">Sign in with Google to buy and keep ${escapeHtml(
        app.name
      )} in your Library.</div>`
}

${purchaseBlock}

<section class="section">
  <div class="section-head"><h2>Preview</h2></div>
  <div class="shots">${shots}</div>
</section>

<section class="section">
  <div class="section-head"><h2>About</h2></div>
  <div class="two-col">
    <div class="prose"><p>${escapeHtml(app.description)}</p></div>
    <ul class="included">${included}</ul>
  </div>
</section>

<section class="section">
  <div class="section-head"><h2>Information</h2></div>
  <div class="info">
    <div class="cell"><div class="k">Developer</div><div class="v">${escapeHtml(
      app.developer
    )}</div></div>
    <div class="cell"><div class="k">Category</div><div class="v">${escapeHtml(
      catName(app.category)
    )}</div></div>
    <div class="cell"><div class="k">Size</div><div class="v">${escapeHtml(
      app.size
    )}</div></div>
    <div class="cell"><div class="k">Age rating</div><div class="v">${escapeHtml(
      app.ageRating
    )}</div></div>
    <div class="cell"><div class="k">Updated</div><div class="v">Oct 2026</div></div>
  </div>
</section>
`
  );
}

function tierCard(app, t, csrf) {
  const feature = t.id === "lifetime";
  const per =
    t.period === "monthly" ? `<span class="per">/month</span>` : "";
  const badge = t.badge ? `<span class="badge">${escapeHtml(t.badge)}</span>` : "";
  const buyLabel =
    t.period === "lifetime"
      ? `Buy lifetime — ${formatPrice(t.priceCents)}`
      : `Subscribe — ${formatPrice(t.priceCents)}/mo`;
  return `<div class="tier ${feature ? "feature" : ""}">
    ${badge}
    <div class="tlabel">${escapeHtml(t.label)}</div>
    <div class="price">${formatPrice(t.priceCents)}${per}</div>
    <div class="blurb">${escapeHtml(t.blurb)}</div>
    <form method="post" action="/checkout">
      <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
      <input type="hidden" name="product" value="${escapeHtml(app.slug)}">
      <input type="hidden" name="tier" value="${escapeHtml(t.id)}">
      <button class="btn ${feature ? "btn-primary" : "btn-ghost"} btn-block btn-lg" type="submit">${buyLabel}</button>
    </form>
  </div>`;
}

/* ----------------------------- Library ----------------------------- */
export function libraryPage(ctx, { user, items }) {
  const av = user.picture
    ? `<img class="big-avatar" src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="big-avatar fallback">${escapeHtml(
        initials(user.name, user.email)
      )}</span>`;

  const account = `
<div class="panel account reveal">
  ${av}
  <div>
    <div class="who-name">${escapeHtml(user.name || "Your account")}</div>
    <div class="who-sub">${escapeHtml(user.email || "")} · Member since ${fmtDate(
    user.created_at
  )}</div>
  </div>
  <div class="acct-actions"><a class="btn btn-ghost" href="/auth/logout">Sign out</a></div>
</div>`;

  let listing;
  if (!items.length) {
    listing = `<div class="empty">
      <h3>Your Library is empty</h3>
      <p>Apps you buy show up here, ready to open.</p>
      <div style="margin-top:14px"><a class="btn btn-primary" href="/app/exodus">Browse Exodus</a></div>
    </div>`;
  } else {
    listing = `<div class="grid">${items
      .map((it) => libraryCard(it))
      .join("\n")}</div>`;
  }

  return layout(
    { ...ctx, title: "Library" },
    `
<section class="section" style="margin-top:28px">
  ${account}
</section>
<section class="section">
  <div class="section-head">
    <h2>Your apps</h2>
    <span class="sub">${items.length} ${items.length === 1 ? "app" : "apps"}</span>
  </div>
  ${listing}
</section>
`
  );
}

function libraryCard(it) {
  const a = it.app;
  let pill;
  if (!it.active) pill = `<span class="status-pill expired">Expired</span>`;
  else if (it.lifetime) pill = `<span class="status-pill life">Lifetime</span>`;
  else
    pill = `<span class="status-pill active">Until ${fmtDate(
      it.expires_at
    )}</span>`;

  return `<a class="app-card stretch-link" href="/app/${a.slug}">
    ${appIcon(a, 56)}
    <div class="meta">
      <div class="name">${escapeHtml(a.name)}</div>
      <p class="tg">${escapeHtml(a.tagline)}</p>
      <div class="row">
        ${pill}
        <span class="btn btn-ghost" aria-hidden="true">Open</span>
      </div>
    </div>
  </a>`;
}

/* ----------------------------- Message pages ----------------------------- */
export function messagePage(ctx, { icon = "◆", title, html, actions = "" }) {
  return layout(
    { ...ctx, title },
    `<div class="center-wrap"><div class="card-narrow reveal">
      <div style="font-size:30px">${icon}</div>
      <h1>${escapeHtml(title)}</h1>
      ${html}
      ${actions}
    </div></div>`
  );
}

export function notFoundPage(ctx) {
  return messagePage(ctx, {
    icon: "🔎",
    title: "Not found",
    html: `<p>That page doesn't exist on larpstore.</p>`,
    actions: `<a class="btn btn-primary" href="/">Back to Discover</a>`,
  });
}

export function notConfiguredPage(ctx) {
  return messagePage(ctx, {
    icon: "🔑",
    title: "Google sign-in isn't set up yet",
    html: `<p>The site owner needs to add Google OAuth credentials. Set
      <span class="kbd">GOOGLE_CLIENT_ID</span> and
      <span class="kbd">GOOGLE_CLIENT_SECRET</span> in the <span class="kbd">.env</span>
      file, then restart. The README has step-by-step instructions.</p>`,
    actions: `<a class="btn btn-ghost" href="/">Back to Discover</a>`,
  });
}

export function authErrorPage(ctx, message) {
  return messagePage(ctx, {
    icon: "⚠️",
    title: "Sign-in didn't complete",
    html: `<p>${escapeHtml(message)}</p>`,
    actions: `<a class="btn btn-primary" href="/auth/google">Try again</a>
      <a class="btn btn-ghost" href="/">Home</a>`,
  });
}

/* ----------------------------- helpers ----------------------------- */
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatRatingCount(n) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#4c33d1"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" font-size="18" font-family="sans-serif" font-weight="700" fill="#fff">◆</text></svg>`;
}
