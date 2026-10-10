# larpstore.app

An **App Store–style storefront for larped apps**, headlined by **Exodus**
(1 month — **$6**, Lifetime — **$20**). Real "Sign in with Google", accounts
and purchases saved to a database, and a Library page showing what each user
owns.

Built on **Node's built-in modules only — zero npm dependencies**. No native
builds, nothing to compile, nothing to pull from a registry. If you have Node
22.5+ you can run it.

---

## What's inside

| Area | How it works |
|------|--------------|
| Server | Node's built-in `http` — a small router, no Express |
| Database | Node's built-in `node:sqlite` — a single file at `data/larpstore.db` |
| Auth | Google OAuth 2.0 (Authorization Code + PKCE), hand-rolled, no `passport` |
| Sessions | Signed cookie (HMAC-SHA256) + server-side session rows in SQLite |
| Security | CSRF tokens on checkout, session regeneration on login, parameterised SQL, `HttpOnly`/`SameSite` cookies |
| UI | Server-rendered dark "software drop" theme; generated SVG app icons |

Accounts (`users`), logins (`sessions`) and purchases (`entitlements`) are all
persisted. Monthly purchases expire after 30 days; lifetime never expires.

---

## 1. Run it locally

```bash
# 1. Node 22.5 or newer is required
node --version        # must be >= 22.5.0

# 2. Configure
cp .env.example .env  # then open .env (see step 2 for Google keys)

# 3. Start
npm start             # or: node src/server.js
```

Open **http://localhost:3000**.

The store works immediately. Until you add Google keys (next step) the "Sign in"
button shows a short "not set up yet" page instead of logging in — the app does
**not** crash.

> No `npm install` step is needed — there are no dependencies.

---

## 2. Turn on "Sign in with Google"

1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)** and
   create (or pick) a project.
2. **APIs & Services → OAuth consent screen** → set it up (External is fine).
   Add yourself under **Test users** while developing.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - **Authorised redirect URIs** → add exactly:
     ```
     http://localhost:3000/auth/google/callback
     ```
     (and later your production one, e.g. `https://larpstore.app/auth/google/callback`)
4. Copy the **Client ID** and **Client secret** into your `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   ```
5. Restart the server. Click **Sign in with Google** — you'll be returned
   signed in, with your account saved in the database.

The redirect URI must match **character for character**, including
`http`/`https`, host, and port. Mismatch is the #1 cause of Google login errors.

---

## 3. Buying flow (DEMO vs real money)

Out of the box the store runs in **DEMO checkout mode**: pressing *Buy lifetime
— $20* or *Subscribe — $6/mo* records the purchase to the `entitlements` table
and drops the app into the buyer's **Library**. This exercises the whole
account + ownership system with **no real charges**.

### Taking real payments with Stripe

When you're ready to charge real money:

1. Add your keys to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
2. In `src/server.js`, find `handleCheckout()`. The real-payment branch is
   already stubbed and clearly marked. Replace it with a Stripe **Checkout
   Session** redirect, then grant the entitlement from the **verified webhook**
   (never trust the browser's "success" redirect alone). The grant call is the
   one line you already have:
   ```js
   grantEntitlement({ userId, product, tier, priceCents, durationDays, orderRef });
   ```
   Use `durationDays = 30` for monthly and `null` for lifetime.

Stripe's SDK is the one place you'd add an npm dependency (`npm i stripe`); the
rest of the app stays dependency-free.

---

## 4. Project layout

```
larpstore/
├── src/
│   ├── server.js     HTTP server, router, static files, checkout
│   ├── config.js     reads .env (tiny parser, no dotenv)
│   ├── db.js         SQLite schema + queries (users, sessions, entitlements)
│   ├── session.js    signed-cookie sessions + CSRF
│   ├── auth.js       Google OAuth 2.0 (PKCE) flow
│   ├── catalog.js    the apps + pricing (Exodus lives here)
│   ├── views.js      server-rendered HTML + generated SVG icons
│   └── quiet.js      silences the SQLite "experimental" console notice
├── public/
│   ├── styles.css    the theme
│   └── app.js        light progressive enhancement
├── data/             SQLite database is created here on first run
├── .env.example      copy to .env
└── package.json
```

### Changing the catalog / prices
Everything about the apps and tiers is in **`src/catalog.js`**. Prices are in
**cents** (`priceCents: 600` = $6.00). Add an app by adding an object to `APPS`;
give it `tiers` to make it purchasable, or `comingSoon: true` for a teaser tile.

---

## 5. API (JSON)

| Route | Returns |
|-------|---------|
| `GET /api/me` | the signed-in user and their entitlements, or `{authenticated:false}` |
| `GET /api/catalog` | all apps and their tiers |
| `GET /healthz` | `{ ok: true, users, entitlements, sessions }` |

---

## 6. Deploying

- Set `NODE_ENV=production`, a real `BASE_URL` (https), `SECURE_COOKIES=true`,
  and a strong `SESSION_SECRET`.
- Add the production redirect URI in the Google console.
- Run behind a TLS-terminating proxy (Caddy, Nginx, Fly.io, Render, a VPS…).
  Any host that runs Node 22.5+ works; the SQLite file just needs a persistent
  disk.
- Point `larpstore.app`'s DNS at the host.

---

Built for larped apps. Have fun.
