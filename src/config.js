// config.js — loads configuration from a .env file (no external dependency).
// A tiny, forgiving .env parser so we don't need the `dotenv` package.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Do not override variables already present in the real environment.
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(join(ROOT, ".env"));

function bool(v, dflt = false) {
  if (v === undefined) return dflt;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

// A stable-ish session secret. In production you MUST set SESSION_SECRET.
// If it is missing we generate an ephemeral one and warn — sessions then reset
// whenever the server restarts, but the app still runs with no crash.
let sessionSecret = process.env.SESSION_SECRET;
let sessionSecretEphemeral = false;
if (!sessionSecret || sessionSecret.length < 16) {
  sessionSecret = crypto.randomBytes(32).toString("hex");
  sessionSecretEphemeral = true;
}

const config = {
  root: ROOT,
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  // Public base URL of the site. Used to build the OAuth redirect URI.
  baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || "3000"}`).replace(/\/+$/, ""),

  sessionSecret,
  sessionSecretEphemeral,
  // Secure cookies only when explicitly behind HTTPS in production.
  secureCookies: bool(process.env.SECURE_COOKIES, (process.env.NODE_ENV === "production")),

  dbPath: process.env.DB_PATH || join(ROOT, "data", "larpstore.db"),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Where Google redirects back to after login.
    get redirectUri() {
      return (
        process.env.GOOGLE_REDIRECT_URI ||
        `${config.baseUrl}/auth/google/callback`
      );
    },
    get configured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  // Payments. When Stripe keys are absent the store runs in DEMO checkout mode:
  // purchases are recorded to the database so the full account/ownership flow
  // works, but no real money moves. See README for wiring real Stripe.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    get configured() {
      return Boolean(this.secretKey);
    },
  },

  get demoCheckout() {
    return !config.stripe.configured;
  },
};

export default config;
