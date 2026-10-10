// server.js — larpstore.app
// A zero-dependency HTTP server on Node's built-in modules. Routing, static
// files, sessions, Google OAuth, and the checkout/entitlement flow.

import "./quiet.js"; // must be first: silences the SQLite experimental notice

import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import config from "./config.js";
import {
  syncCatalog,
  sessionStore,
  getUserById,
  getUserByUsername,
  userIsVerified,
  getUserEntitlements,
  grantEntitlement,
  userOwnsProduct,
  getProductRating,
  getUserRating,
  setRating,
  stats,
} from "./db.js";
import { attachSession, getCsrfToken, verifyCsrf } from "./session.js";
import * as auth from "./auth.js";
import * as localauth from "./localauth.js";
import { APPS, getApp, getTier } from "./catalog.js";
import * as views from "./views.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(config.root, "public");

// Seed/refresh the product table from the code catalog.
syncCatalog();

// ---------------------------------------------------------------------------
// Tiny response helpers
// ---------------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(body);
}
function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
  });
}
function redirect(res, location, status = 302) {
  res.writeHead(status, { Location: location });
  res.end();
}

const helpers = {
  redirect,
  renderNotConfigured(res, ctx) {
    send(res, 200, views.notConfiguredPage(ctx || {}));
  },
  renderAuthError(res, msg, ctx) {
    send(res, 200, views.authErrorPage(ctx || {}, msg));
  },
  renderLogin(res, opts = {}) {
    send(res, 200, views.loginPage({
      ...opts,
      googleConfigured: config.google.configured,
    }));
  },
};

// ---------------------------------------------------------------------------
// Static files (safe: confined to /public)
// ---------------------------------------------------------------------------
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

async function serveStatic(req, res, urlPath) {
  // Normalize and ensure the resolved path stays inside PUBLIC_DIR.
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, "Forbidden");
  }
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    // CSS/JS carry a ?v= cache-buster and must never be served stale, so always
    // revalidate. Images are content-addressed by name and can cache.
    let cache;
    if (ext === ".css" || ext === ".js") {
      cache = "no-cache, must-revalidate";
    } else {
      cache = config.env === "production" ? "public, max-age=86400" : "no-cache";
    }
    send(res, 200, data, { "Content-Type": type, "Cache-Control": cache });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Body parsing (application/x-www-form-urlencoded)
// ---------------------------------------------------------------------------
function parseBody(req, limitBytes = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const ct = req.headers["content-type"] || "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      } else if (ct.includes("application/json")) {
        try {
          resolve(JSON.parse(raw || "{}"));
        } catch {
          resolve({});
        }
      } else {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Request context
// ---------------------------------------------------------------------------
function buildContext(req) {
  const user = req.session.userId ? getUserById(req.session.userId) : null;
  let ownedSlugs = new Set();
  if (user) {
    for (const e of getUserEntitlements(user.id)) {
      if (e.active) ownedSlugs.add(e.product);
    }
  }
  return { user, path: req._pathname, ownedSlugs };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
// Home page: the zlarp-style store grid (every non-hidden catalog app).
function handleHome(req, res, ctx) {
  const apps = APPS.filter((a) => !a.comingSoon).map((a) => ({
    app: a,
    rating: getProductRating(a.slug),
  }));
  send(res, 200, views.storeHomePage(ctx, { apps }));
}

function handleAppPage(req, res, ctx, slug) {
  const app = getApp(slug);
  if (!app || app.comingSoon) return send(res, 404, views.notFoundPage(ctx));

  let owns = false;
  let entitlement = null;
  let userRating = null;
  if (ctx.user) {
    const ents = getUserEntitlements(ctx.user.id).filter(
      (e) => e.product === slug && e.active
    );
    if (ents.length) {
      owns = true;
      entitlement = ents.find((e) => e.lifetime) || ents[0];
    }
    userRating = getUserRating(ctx.user.id, slug);
  }

  const rating = getProductRating(slug);

  // Post-checkout / error flash + rating prompt via query params.
  let flash = null;
  if (req._query.get("bought")) {
    flash = { kind: "ok", msg: `You're all set — ${app.name} is now in your Library. Mind leaving a rating?` };
  } else if (req._query.get("rated")) {
    flash = { kind: "ok", msg: "Thanks — your rating is live." };
  } else if (req._query.get("err")) {
    flash = { kind: "warn", msg: decodeURIComponent(req._query.get("err")) };
  }

  const showRatePrompt =
    owns && (req._query.get("rate") === "1" || req._query.get("bought"));

  const csrf = getCsrfToken(req);
  send(
    res,
    200,
    views.appPage(ctx, {
      app,
      owns,
      entitlement,
      csrf,
      flash,
      rating,
      userRating,
      showRatePrompt,
    })
  );
}

function handleProfile(req, res, ctx, username) {
  const profileUser = getUserByUsername(username);
  if (!profileUser) return send(res, 404, views.notFoundPage(ctx));
  const isVerified = userIsVerified(profileUser);
  // "Creations" = catalog apps whose developer matches this username.
  const apps = APPS.filter(
    (a) =>
      a.developer &&
      a.developer.toLowerCase() === (profileUser.username || "").toLowerCase()
  );
  send(res, 200, views.developerProfilePage(ctx, { profileUser, isVerified, apps }));
}

async function handleRate(req, res, ctx) {
  const body = await parseBody(req);
  if (!ctx.user) return redirect(res, "/login");
  if (!verifyCsrf(req, body._csrf)) {
    return redirect(res, `/app/exodus?err=${encodeURIComponent("Please try rating again.")}`);
  }
  const app = getApp(body.product);
  if (!app) return redirect(res, "/");
  // Only buyers can rate.
  if (!userOwnsProduct(ctx.user.id, app.slug)) {
    return redirect(res, `/app/${app.slug}?err=${encodeURIComponent("Buy the app to rate it.")}`);
  }
  const stars = parseInt(body.stars, 10);
  if (!(stars >= 1 && stars <= 5)) {
    return redirect(res, `/app/${app.slug}?rate=1#rate`);
  }
  setRating(ctx.user.id, app.slug, stars);
  return redirect(res, `/app/${app.slug}?rated=1`);
}

function handleLibrary(req, res, ctx) {
  if (!ctx.user) {
    return redirect(res, "/login");
  }
  const raw = getUserEntitlements(ctx.user.id);
  // Attach the catalog app to each entitlement; skip unknown products.
  const items = raw
    .map((e) => {
      const app = getApp(e.product);
      return app ? { ...e, app } : null;
    })
    .filter(Boolean);
  send(res, 200, views.libraryPage(ctx, { user: ctx.user, items }));
}

async function handleCheckout(req, res, ctx) {
  const body = await parseBody(req);

  // Require a signed-in user.
  if (!ctx.user) {
    return redirect(res, "/login");
  }

  // CSRF protection.
  if (!verifyCsrf(req, body._csrf)) {
    return redirect(
      res,
      `/app/${encodeURIComponent(body.product || "exodus")}?err=${encodeURIComponent(
        "Your session expired. Please try the purchase again."
      )}`
    );
  }

  const app = getApp(body.product);
  const tier = getTier(app, body.tier);
  if (!app || !tier) {
    return redirect(
      res,
      `/?err=${encodeURIComponent("That item is not available.")}`
    );
  }

  // --- Payment -------------------------------------------------------------
  // DEMO MODE (no Stripe key): record the purchase so the account + Library
  // flow works end to end. When STRIPE_SECRET_KEY is set you would instead
  // create a Stripe Checkout Session here and grant the entitlement from the
  // verified webhook. See README "Taking real payments".
  if (!config.demoCheckout) {
    // Placeholder for real Stripe redirect. Intentionally not implemented with
    // live keys here; see README. We fail safe rather than pretend to charge.
    return redirect(
      res,
      `/app/${app.slug}?err=${encodeURIComponent(
        "Live payments are configured but the Stripe handler isn't wired yet. See README."
      )}`
    );
  }

  const durationDays = tier.period === "lifetime" ? null : 30;
  grantEntitlement({
    userId: ctx.user.id,
    product: app.slug,
    tier: tier.id,
    priceCents: tier.priceCents,
    durationDays,
    orderRef: "demo-" + Date.now().toString(36),
  });

  return redirect(res, `/app/${app.slug}?bought=${encodeURIComponent(tier.id)}#rate`);
}

function handleApiMe(req, res, ctx) {
  if (!ctx.user) return sendJson(res, 200, { authenticated: false });
  const ents = getUserEntitlements(ctx.user.id).map((e) => ({
    product: e.product,
    tier: e.tier,
    active: e.active,
    lifetime: e.lifetime,
    expires_at: e.expires_at,
    price_cents: e.price_cents,
  }));
  sendJson(res, 200, {
    authenticated: true,
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      picture: ctx.user.picture,
      created_at: ctx.user.created_at,
    },
    entitlements: ents,
  });
}

function handleApiCatalog(req, res) {
  sendJson(res, 200, {
    apps: APPS.map((a) => ({
      slug: a.slug,
      name: a.name,
      tagline: a.tagline,
      category: a.category,
      comingSoon: !!a.comingSoon,
      tiers: a.tiers.map((t) => ({
        id: t.id,
        label: t.label,
        period: t.period,
        priceCents: t.priceCents,
      })),
    })),
  });
}

// ---------------------------------------------------------------------------
// Main request router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl);
    const pathname = decodeURIComponent(url.pathname);
    req._pathname = pathname;
    req._query = url.searchParams;
    req.query = Object.fromEntries(url.searchParams); // for auth.js convenience

    // Sessions on every request.
    attachSession(req, res);

    // Fast paths that don't need a full context.
    if (pathname === "/healthz") {
      return sendJson(res, 200, { ok: true, ...stats() });
    }
    if (pathname === "/favicon.svg") {
      return send(res, 200, views.faviconSvg(), {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      });
    }

    // Static assets.
    if (
      pathname === "/styles.css" ||
      pathname === "/app.js" ||
      pathname === "/auth.js" ||
      pathname.startsWith("/assets/")
    ) {
      const served = await serveStatic(req, res, pathname);
      if (served) return;
      return send(res, 404, "Not found");
    }

    const ctx = buildContext(req);

    // Login landing + email/password auth.
    if (pathname === "/login" && req.method === "GET") {
      if (ctx.user) return redirect(res, "/");
      const mode = req._query.get("mode") === "signup" ? "signup" : "login";
      return helpers.renderLogin(res, { mode });
    }
    if (pathname === "/auth/signup" && req.method === "POST") {
      const body = await parseBody(req);
      return localauth.handleSignup(req, res, body, helpers);
    }
    if (pathname === "/auth/login" && req.method === "POST") {
      const body = await parseBody(req);
      return localauth.handleLogin(req, res, body, helpers);
    }

    // Auth routes.
    if (pathname === "/auth/google" && req.method === "GET") {
      return auth.startGoogleLogin(req, res, {
        ...helpers,
        renderNotConfigured: (r) => helpers.renderNotConfigured(r, ctx),
      });
    }
    if (pathname === "/auth/google/callback" && req.method === "GET") {
      return auth.handleGoogleCallback(req, res, {
        ...helpers,
        renderNotConfigured: (r) => helpers.renderNotConfigured(r, ctx),
        renderAuthError: (r, m) => helpers.renderAuthError(r, m, ctx),
      });
    }
    if (pathname === "/auth/logout") {
      return auth.logout(req, res, helpers);
    }

    // API.
    if (pathname === "/api/me" && req.method === "GET")
      return handleApiMe(req, res, ctx);
    if (pathname === "/api/catalog" && req.method === "GET")
      return handleApiCatalog(req, res);

    // Pages (store is gated — visitors see the login page first).
    if (pathname === "/" && req.method === "GET") {
      if (!ctx.user) return redirect(res, "/login");
      return handleHome(req, res, ctx);
    }

    if (pathname === "/library" && req.method === "GET") {
      if (!ctx.user) return redirect(res, "/login");
      return handleLibrary(req, res, ctx);
    }

    if (pathname === "/checkout" && req.method === "POST")
      return handleCheckout(req, res, ctx);

    if (pathname === "/rate" && req.method === "POST")
      return handleRate(req, res, ctx);

    const appMatch = pathname.match(/^\/app\/([a-z0-9-]+)$/i);
    if (appMatch && req.method === "GET") {
      if (!ctx.user) return redirect(res, "/login");
      return handleAppPage(req, res, ctx, appMatch[1]);
    }

    const profMatch = pathname.match(/^\/u\/([a-z0-9_]+)$/i);
    if (profMatch && req.method === "GET") {
      if (!ctx.user) return redirect(res, "/login");
      return handleProfile(req, res, ctx, profMatch[1]);
    }

    // Fallback 404.
    return send(res, 404, views.notFoundPage(ctx));
  } catch (err) {
    console.error("[request error]", err);
    if (!res.headersSent) {
      send(res, 500, "<h1>Something went wrong</h1>");
    } else {
      try {
        res.end();
      } catch {}
    }
  }
});

// Periodically purge expired sessions.
const purgeTimer = setInterval(() => {
  try {
    sessionStore.purgeExpired();
  } catch {}
}, 60 * 60 * 1000);
purgeTimer.unref?.();

server.listen(config.port, () => {
  const g = config.google.configured
    ? "configured ✓"
    : "NOT configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)";
  const pay = config.demoCheckout
    ? "DEMO mode (no charges; set STRIPE_SECRET_KEY for live)"
    : "Stripe key present";
  console.log("");
  console.log("  larpstore.app is running");
  console.log("  ──────────────────────────────────────────");
  console.log(`  URL          ${config.baseUrl}`);
  console.log(`  Port         ${config.port}`);
  console.log(`  Env          ${config.env}`);
  console.log(`  Database     ${config.dbPath}`);
  console.log(`  Google OAuth ${g}`);
  console.log(`  Payments     ${pay}`);
  if (config.sessionSecretEphemeral) {
    console.log(
      "  Note         SESSION_SECRET not set — using a temporary one (logins reset on restart)."
    );
  }
  console.log("");
});

export default server;
