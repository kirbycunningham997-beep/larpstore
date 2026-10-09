// db.js — SQLite persistence using Node's built-in `node:sqlite` (Node >= 22.5).
// No native build, no external driver. Stores users, sessions, products and
// entitlements (purchases). All writes use parameterized statements.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import crypto from "node:crypto";
import config from "./config.js";
import { APPS } from "./catalog.js";

// Ensure the data directory exists before opening the file.
mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// Pragmas for reliability + concurrency.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  google_sub    TEXT UNIQUE,
  email         TEXT,
  email_verified INTEGER DEFAULT 0,
  name          TEXT,
  picture       TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  user_id    TEXT,
  data       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  slug      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  tagline   TEXT,
  category  TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  product    TEXT NOT NULL,
  tier       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  price_cents INTEGER NOT NULL DEFAULT 0,
  order_ref  TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// --- Migrations ------------------------------------------------------------
// Add password_hash for email/password accounts (users created via Google
// leave it NULL). Safe to run every boot.
{
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some((c) => c.name === "password_hash")) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
}
// Case-insensitive uniqueness for emails that are set.
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email)) WHERE email IS NOT NULL"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function uuid() {
  return crypto.randomUUID();
}
function nowIso() {
  return new Date().toISOString();
}

// Sync the in-code catalog into the products table (upsert).
export function syncCatalog() {
  const upsert = db.prepare(`
    INSERT INTO products (slug, name, tagline, category, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      tagline = excluded.tagline,
      category = excluded.category,
      updated_at = excluded.updated_at
  `);
  const ts = nowIso();
  for (const a of APPS) {
    upsert.run(a.slug, a.name, a.tagline || "", a.category || "", ts);
  }
}

// ---- Users ----------------------------------------------------------------
const stmtUserBySub = db.prepare("SELECT * FROM users WHERE google_sub = ?");
const stmtUserById = db.prepare("SELECT * FROM users WHERE id = ?");

export function getUserById(id) {
  if (!id) return null;
  return stmtUserById.get(id) || null;
}

/**
 * Create or update a user from a Google profile. Returns the user row.
 */
export function upsertGoogleUser(profile) {
  const existing = stmtUserBySub.get(profile.sub);
  const ts = nowIso();
  if (existing) {
    db.prepare(
      `UPDATE users SET email = ?, email_verified = ?, name = ?, picture = ?, last_login_at = ?
       WHERE id = ?`
    ).run(
      profile.email || existing.email,
      profile.email_verified ? 1 : 0,
      profile.name || existing.name,
      profile.picture || existing.picture,
      ts,
      existing.id
    );
    return stmtUserById.get(existing.id);
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, google_sub, email, email_verified, name, picture, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    profile.sub,
    profile.email || null,
    profile.email_verified ? 1 : 0,
    profile.name || null,
    profile.picture || null,
    ts,
    ts
  );
  return stmtUserById.get(id);
}

// ---- Email / password accounts --------------------------------------------
export function getUserByEmail(email) {
  if (!email) return null;
  return (
    db
      .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
      .get(email) || null
  );
}

/**
 * Create a user with an email + password hash. Throws if the email is taken.
 * Returns the new user row.
 */
export function createLocalUser({ email, name, passwordHash }) {
  if (getUserByEmail(email)) {
    const err = new Error("EMAIL_TAKEN");
    err.code = "EMAIL_TAKEN";
    throw err;
  }
  const id = uuid();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, google_sub, email, email_verified, name, picture, password_hash, created_at, last_login_at)
     VALUES (?, NULL, ?, 0, ?, NULL, ?, ?, ?)`
  ).run(id, email, name || null, passwordHash, ts, ts);
  return stmtUserById.get(id);
}

export function touchLogin(userId) {
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
    nowIso(),
    userId
  );
}

// ---- Sessions (store backing for session.js) ------------------------------
const stmtSessionGet = db.prepare("SELECT * FROM sessions WHERE sid = ?");

export const sessionStore = {
  get(sid) {
    const row = stmtSessionGet.get(sid);
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.destroy(sid);
      return null;
    }
    let data = {};
    try {
      data = JSON.parse(row.data || "{}");
    } catch {
      data = {};
    }
    return { sid: row.sid, userId: row.user_id, data, expiresAt: row.expires_at };
  },
  create(sid, { userId = null, data = {}, expiresAt }) {
    db.prepare(
      `INSERT INTO sessions (sid, user_id, data, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sid, userId, JSON.stringify(data || {}), nowIso(), expiresAt);
  },
  save(sid, { userId, data, expiresAt }) {
    db.prepare(
      `UPDATE sessions SET user_id = ?, data = ?, expires_at = ? WHERE sid = ?`
    ).run(userId ?? null, JSON.stringify(data || {}), expiresAt, sid);
  },
  destroy(sid) {
    db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
  },
  purgeExpired() {
    const res = db
      .prepare("DELETE FROM sessions WHERE expires_at < ?")
      .run(nowIso());
    return res.changes;
  },
};

// ---- Entitlements (purchases) ---------------------------------------------
const stmtEntsByUser = db.prepare(
  "SELECT * FROM entitlements WHERE user_id = ? ORDER BY created_at DESC"
);

/**
 * Grant an entitlement to a user. `durationDays` null => lifetime (no expiry).
 * Returns the created entitlement row.
 */
export function grantEntitlement({
  userId,
  product,
  tier,
  priceCents = 0,
  durationDays = null,
  orderRef = null,
}) {
  const id = uuid();
  const created = new Date();
  let expiresAt = null;
  if (durationDays != null) {
    const d = new Date(created.getTime() + durationDays * 24 * 60 * 60 * 1000);
    expiresAt = d.toISOString();
  }
  db.prepare(
    `INSERT INTO entitlements
       (id, user_id, product, tier, status, price_cents, order_ref, created_at, expires_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    product,
    tier,
    priceCents,
    orderRef,
    created.toISOString(),
    expiresAt
  );
  return db.prepare("SELECT * FROM entitlements WHERE id = ?").get(id);
}

/**
 * Return a user's entitlements with a computed `active` flag (lifetime always
 * active; monthly active while not past expiry).
 */
export function getUserEntitlements(userId) {
  const rows = stmtEntsByUser.all(userId);
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    lifetime: r.expires_at == null,
    active:
      r.status === "active" &&
      (r.expires_at == null || new Date(r.expires_at).getTime() > now),
  }));
}

/** Does the user currently own (active) the given product? */
export function userOwnsProduct(userId, product) {
  if (!userId) return false;
  return getUserEntitlements(userId).some(
    (e) => e.product === product && e.active
  );
}

export function stats() {
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const ents = db.prepare("SELECT COUNT(*) AS n FROM entitlements").get().n;
  const sess = db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n;
  return { users, entitlements: ents, sessions: sess };
}
