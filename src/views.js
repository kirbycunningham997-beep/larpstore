// views.js — server-rendered HTML for larpstore.app.
// Pure string templates (no template engine). Everything user-derived is
// escaped. App icons are generated inline as SVG squircles (no binary assets).

import config from "./config.js";
import { CATEGORIES, formatPrice } from "./catalog.js";

// Changes every time the server restarts (i.e. every deploy), so browsers
// always fetch a fresh stylesheet/script instead of a cached stale one.
export const ASSET_V = Date.now().toString(36);

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isVerifiedUser(u) {
  return Boolean(u && u.username && u.username.toLowerCase() === "larpstore");
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

/** App icon: the uploaded image when the app has one, else a generated glyph. */
export function appIcon(app, size = 72) {
  if (app.iconImage) {
    return `<img class="app-icon" src="${escapeHtml(app.iconImage)}" width="${size}" height="${size}" alt="${escapeHtml(
      app.name
    )} icon" style="border-radius:${Math.round(size * 0.223)}px;object-fit:cover">`;
  }
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

// Blue verified checkmark badge (Twitter/X style scalloped seal).
export function verifiedBadge(size = 18) {
  return `<svg class="verified" width="${size}" height="${size}" viewBox="0 0 24 24" aria-label="Verified" role="img" xmlns="http://www.w3.org/2000/svg"><path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.66-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/><path fill="#fff" d="M9.8 17.3l-4.4-4.4 1.6-1.6 2.8 2.8 6-6 1.6 1.6z"/></svg>`;
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
    const badge = isVerifiedUser(u) ? ` ${verifiedBadge(14)}` : "";
    return `<a class="nav-link ${ctx.path === "/library" ? "active" : ""}" href="/library">Library</a>
      <span class="who">${av}<span class="name">${escapeHtml(u.username || u.name || u.email || "You")}</span>${badge}</span>
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
<link rel="stylesheet" href="/styles.css?v=${ASSET_V}">
</head>
<body>
<header class="nav">
  <div class="container nav-inner">
    <a class="brand" href="/"><span class="mark">${larpIcon(30)}</span>larp<span class="dim">store</span></a>
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
<script src="/app.js?v=${ASSET_V}" defer></script>
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

/* ----------------------------- App detail (zlarp-style) -------------------- */
export function appPage(
  ctx,
  { app, owns, entitlement, csrf, flash, rating, userRating, showRatePrompt }
) {
  const monthly = app.tiers.find((t) => t.id === "monthly");
  const lifetime = app.tiers.find((t) => t.id === "lifetime");

  // Header action area.
  let headerAction;
  if (owns) {
    headerAction = `<a class="btn btn-primary btn-lg" href="/library">Open</a>`;
  } else {
    headerAction = `<a class="btn btn-primary btn-lg" href="#buy">Get Exodus — ${formatPrice(
      lifetime.priceCents
    )}</a>`;
  }

  // Screenshots (real images with captions).
  const shots = app.screenshots
    .map(
      (s) => `<figure class="shot">
        <img src="${escapeHtml(s.src)}" alt="${escapeHtml(s.caption)}" loading="lazy">
        <figcaption>${escapeHtml(s.caption)}</figcaption>
      </figure>`
    )
    .join("\n");

  const included = app.highlights
    .map((h) => `<li><span class="tick">✓</span><span>${escapeHtml(h)}</span></li>`)
    .join("\n");

  // Rating summary for the stat bar.
  const ratingValue = rating.count
    ? rating.avg.toFixed(1)
    : "New";
  const ratingSub = rating.count
    ? `${formatRatingCount(rating.count)} ${rating.count === 1 ? "rating" : "ratings"}`
    : "No ratings yet";

  // Post-purchase rating prompt.
  let ratePromptHtml = "";
  if (showRatePrompt && owns) {
    ratePromptHtml = `
<div class="rate-prompt" id="rate">
  <div class="rate-head">
    <strong>How's ${escapeHtml(app.name)}?</strong>
    <span>${userRating ? "Update your rating" : "Tap a star to rate it"}</span>
  </div>
  <form method="post" action="/rate" class="star-form">
    <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
    <input type="hidden" name="product" value="${escapeHtml(app.slug)}">
    <div class="star-input">
      ${[5, 4, 3, 2, 1]
        .map(
          (n) =>
            `<input type="radio" id="star${n}" name="stars" value="${n}" ${
              userRating === n ? "checked" : ""
            } required><label for="star${n}" title="${n} star${n > 1 ? "s" : ""}">★</label>`
        )
        .join("")}
    </div>
    <button class="btn btn-primary" type="submit">Submit rating</button>
  </form>
</div>`;
  }

  // Owned panel or the pricing tiers.
  let purchaseBlock;
  if (owns) {
    const status = entitlement.lifetime
      ? `<span class="status-pill life">Lifetime</span>`
      : `<span class="status-pill active">Active until ${fmtDate(entitlement.expires_at)}</span>`;
    purchaseBlock = `
<div class="owned-panel" id="buy">
  <div style="font-size:26px">✓</div>
  <div class="txt">
    <div><strong>${escapeHtml(app.name)} is in your Library.</strong></div>
    <div style="color:var(--muted);font-size:14px">${
      entitlement.lifetime ? "You own this forever." : "Your plan is active."
    } ${status}</div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    ${
      userRating
        ? `<span class="your-rating">Your rating: ${"★".repeat(userRating)}${"☆".repeat(5 - userRating)}</span>`
        : ""
    }
    <a class="btn ${userRating ? "btn-ghost" : "btn-primary"}" href="/app/${app.slug}?rate=1#rate">${
      userRating ? "Change rating" : "Rate this app"
    }</a>
    <a class="btn btn-ghost" href="/library">Open in Library</a>
  </div>
</div>`;
  } else {
    purchaseBlock = `<div class="tiers" id="buy">${app.tiers
      .map((t) => tierCard(app, t, csrf))
      .join("\n")}</div>`;
  }

  const flashHtml = flash
    ? `<div class="notice ${flash.kind}">${escapeHtml(flash.msg)}</div>`
    : "";

  return layout(
    { ...ctx, title: app.name },
    `
${flashHtml}
${ratePromptHtml}

<header class="app-hero reveal">
  <div class="app-hero-icon">${appIcon(app, 120)}</div>
  <div class="app-hero-main">
    <h1 class="app-title">${escapeHtml(app.name)}</h1>
    <p class="app-sub">${escapeHtml(app.tagline)}</p>
    <div class="app-cta">
      <div class="app-price">${formatPrice(lifetime.priceCents)}<span class="app-price-sub"> lifetime · ${formatPrice(
        monthly.priceCents
      )}/mo</span></div>
      ${headerAction}
    </div>
    <div class="app-secure">🔒 Secure checkout · crypto or card</div>
  </div>
  <div class="app-hero-note">${escapeHtml(app.simulatorNote)}</div>
</header>

<div class="statbar">
  <div class="statcell">
    <div class="statlabel">Ratings</div>
    <div class="statval">${ratingValue}</div>
    <div class="statstars">${starsRow(rating.avg)}</div>
    <div class="statsub">${ratingSub}</div>
  </div>
  <div class="statcell">
    <div class="statlabel">Developer</div>
    <div class="statval"><a class="dev-link" href="/u/${encodeURIComponent(app.developer)}">${escapeHtml(app.developer)} ${verifiedBadge(16)}</a></div>
    <div class="statsub">View profile</div>
  </div>
  <div class="statcell">
    <div class="statlabel">Platform</div>
    <div class="statval">${escapeHtml(app.platform)}</div>
    <div class="statsub">${escapeHtml(app.platformKind)}</div>
  </div>
  <div class="statcell">
    <div class="statlabel">Version</div>
    <div class="statval">${escapeHtml(app.version)}</div>
    <div class="statsub">Updated ${relTime(app.updatedAt)}</div>
  </div>
  <div class="statcell">
    <div class="statlabel">Price</div>
    <div class="statval">${formatPrice(lifetime.priceCents)}</div>
    <div class="statsub">from ${formatPrice(monthly.priceCents)}/mo</div>
  </div>
</div>

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
    <div class="cell"><div class="k">Developer</div><div class="v"><a class="dev-link" href="/u/${encodeURIComponent(app.developer)}">${escapeHtml(app.developer)}</a></div></div>
    <div class="cell"><div class="k">Platform</div><div class="v">${escapeHtml(app.platform)}</div></div>
    <div class="cell"><div class="k">Size</div><div class="v">${escapeHtml(app.size)}</div></div>
    <div class="cell"><div class="k">Age rating</div><div class="v">${escapeHtml(app.ageRating)}</div></div>
    <div class="cell"><div class="k">Version</div><div class="v">${escapeHtml(app.version)}</div></div>
  </div>
</section>
`
  );
}

function tierCard(app, t, csrf) {
  const feature = t.id === "lifetime";
  const per = t.period === "monthly" ? `<span class="per">/month</span>` : "";
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

  const verified = isVerifiedUser(user);
  const badge = verified ? ` ${verifiedBadge(18)}` : "";
  const handle = user.username ? `@${escapeHtml(user.username)}` : escapeHtml(user.email || "");
  const devLine = verified
    ? `<span class="dev-tag">Developer · larpstore</span>`
    : "";
  const account = `
<div class="panel account reveal">
  ${av}
  <div>
    <div class="who-name">${escapeHtml(user.name || user.username || "Your account")}${badge}</div>
    <div class="who-sub">${handle} · Member since ${fmtDate(user.created_at)} ${devLine}</div>
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

/* ----------------------------- Developer profile -------------------------- */
export function developerProfilePage(ctx, { profileUser, isVerified, apps }) {
  const name = profileUser.username || profileUser.name || "User";
  const badge = isVerified ? ` ${verifiedBadge(22)}` : "";
  const avatar = profileUser.picture
    ? `<img class="profile-avatar" src="${escapeHtml(profileUser.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="profile-avatar gen">${larpIcon(72)}</span>`;

  const creations = apps.length
    ? `<div class="grid">${apps
        .map(
          (a) => `<a class="app-card stretch-link" href="/app/${a.slug}">
        ${appIcon(a, 56)}
        <div class="meta">
          <div class="name">${escapeHtml(a.name)}</div>
          <p class="tg">${escapeHtml(a.tagline)}</p>
          <div class="row"><span class="cat">${escapeHtml(a.category)}</span><span class="btn btn-ghost" aria-hidden="true">View</span></div>
        </div>
      </a>`
        )
        .join("\n")}</div>`
    : `<div class="empty"><h3>No apps yet</h3><p>This developer hasn't published anything.</p></div>`;

  return layout(
    { ...ctx, title: name },
    `
<a class="back" href="/">‹ Back to store</a>
<div class="panel account reveal" style="margin-top:8px">
  ${avatar}
  <div>
    <div class="who-name" style="font-size:26px">${escapeHtml(name)}${badge}</div>
    <div class="who-sub">${
      isVerified ? "Verified developer" : "Member"
    } · Joined ${fmtDate(profileUser.created_at)}</div>
  </div>
</div>

<section class="section">
  <div class="section-head">
    <h2>${isVerified ? "Creations" : "Apps"}</h2>
    <span class="sub">${apps.length} ${apps.length === 1 ? "app" : "apps"}</span>
  </div>
  ${creations}
</section>
`
  );
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
      <a class="btn btn-ghost" href="/login">Home</a>`,
  });
}

/* ----------------------------- Login / sign-up ----------------------------- */
// Standalone full-screen page (no nav/footer), styled like an app-store login:
// floating blurred app cards behind a centered auth card.
const FLOAT_CARDS = [
  { x: 6, y: 10, w: 150, h: 200, rot: -8, hue: 265, o: 0.5 },
  { x: 22, y: 60, w: 150, h: 200, rot: 7, hue: 150, o: 0.45 },
  { x: 40, y: 2, w: 150, h: 200, rot: 4, hue: 32, o: 0.4 },
  { x: 2, y: 64, w: 130, h: 180, rot: 10, hue: 210, o: 0.4 },
  { x: 78, y: 6, w: 150, h: 200, rot: -6, hue: 350, o: 0.45 },
  { x: 86, y: 44, w: 140, h: 190, rot: 8, hue: 255, o: 0.4 },
  { x: 64, y: 70, w: 150, h: 200, rot: -5, hue: 190, o: 0.4 },
  { x: 48, y: 74, w: 130, h: 180, rot: 6, hue: 48, o: 0.35 },
  { x: 90, y: 78, w: 120, h: 170, rot: -9, hue: 280, o: 0.35 },
  { x: 30, y: 30, w: 120, h: 160, rot: -4, hue: 170, o: 0.25 },
];

export function loginPage({ mode = "login", error = null, values = {}, googleConfigured = false }) {
  const cards = FLOAT_CARDS.map(
    (c) =>
      `<span class="float-card" style="left:${c.x}%;top:${c.y}%;width:${c.w}px;height:${c.h}px;transform:rotate(${c.rot}deg);opacity:${c.o};background:linear-gradient(160deg,hsl(${c.hue} 65% 42%),hsl(${c.hue + 20} 60% 24%))"></span>`
  ).join("");

  const isSignup = mode === "signup";
  const email = escapeHtml(values.email || "");
  const name = escapeHtml(values.name || "");

  const errorHtml = error
    ? `<div class="auth-error">${escapeHtml(error)}</div>`
    : "";

  const google = `
    <div class="auth-divider"><span>or</span></div>
    <a class="btn btn-google btn-block auth-google" href="/auth/google">
      ${googleG()} Continue with Google
    </a>`;

  // Two forms; JS toggles between them. Default shown follows `mode`.
  const body = `
<div class="auth-bg" aria-hidden="true">${cards}</div>
<div class="auth-shell">
  <div class="auth-card">
    <div class="auth-icon">${larpIcon(64)}</div>

    <div class="auth-pane" data-pane="login" ${isSignup ? 'hidden' : ''}>
      <h1>Log in to larpstore</h1>
      ${!isSignup ? errorHtml : ""}
      <form method="post" action="/auth/login" class="auth-form">
        <input type="email" name="email" placeholder="Email" autocomplete="email" required value="${isSignup ? "" : email}">
        <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Log in</button>
      </form>
      <p class="auth-switch">New here? <a href="/login?mode=signup" data-toggle="signup">Create an account</a></p>
      ${google}
    </div>

    <div class="auth-pane" data-pane="signup" ${isSignup ? '' : 'hidden'}>
      <h1>Create your account</h1>
      ${isSignup ? errorHtml : ""}
      <form method="post" action="/auth/signup" class="auth-form">
        <input type="text" name="username" placeholder="Username" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" value="${escapeHtml(values.username || "")}">
        <input type="email" name="email" placeholder="Email" autocomplete="email" required value="${isSignup ? email : ""}">
        <input type="password" name="password" placeholder="Password (8+ characters)" autocomplete="new-password" required minlength="8">
        <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
      </form>
      <p class="auth-switch">Already have an account? <a href="/login" data-toggle="login">Log in</a></p>
      ${google}
    </div>

    <p class="auth-fine">By continuing you agree to the Terms of Use and Privacy Policy.</p>
  </div>
</div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${isSignup ? "Sign up" : "Log in"} — larpstore</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;550;600;650&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${ASSET_V}">
</head>
<body class="auth-body">
${body}
<script src="/auth.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
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

// Five stars rendered from an average (supports halves). null => all empty.
function starsRow(avg) {
  const v = avg || 0;
  let out = "";
  for (let i = 1; i <= 5; i++) {
    if (v >= i) out += `<span class="s full">★</span>`;
    else if (v >= i - 0.5) out += `<span class="s half">★</span>`;
    else out += `<span class="s empty">★</span>`;
  }
  return out;
}

// "today", "yesterday", "N days ago", "N weeks/months ago" from a date string.
function relTime(dateStr) {
  if (!dateStr) return "recently";
  const then = new Date(dateStr);
  if (isNaN(then)) return "recently";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? "" : "s"} ago`;
}

// The larpstore app icon — an App Store–style blue squircle with a constructed
// white "L". Rendered at any size; used for the favicon, the nav mark, and the
// big login badge.
export function larpIcon(size = 512) {
  // The viewBox is a fixed 512 grid; `size` only scales the rendered box.
  // All inner coordinates stay in 512-space so the "L" always fills the icon.
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="larpstore icon">
  <defs>
    <linearGradient id="lrpBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#36B9FF"/>
      <stop offset="1" stop-color="#1667F2"/>
    </linearGradient>
    <linearGradient id="lrpSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#lrpBg)"/>
  <rect width="512" height="256" rx="115" fill="url(#lrpSheen)"/>
  <g fill="#ffffff">
    <rect x="186" y="116" width="66" height="240" rx="33"/>
    <rect x="186" y="290" width="172" height="66" rx="33"/>
  </g>
</svg>`;
}

export function faviconSvg() {
  return larpIcon(64);
}
