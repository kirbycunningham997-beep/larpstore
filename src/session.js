// session.js — signed-cookie sessions backed by SQLite.
//
// The browser only ever holds a session id inside a cookie that is signed with
// HMAC-SHA256 (so it cannot be forged). All real session data lives server-side
// in the `sessions` table. This replaces `express-session` with ~no deps.

import crypto from "node:crypto";
import config from "./config.js";
import { sessionStore, uuid } from "./db.js";

const COOKIE_NAME = "lrp.sid";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(value) {
  const mac = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
  return `${value}.${mac}`;
}

function unsign(signed) {
  if (typeof signed !== "string") return null;
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const value = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
  // Constant-time comparison.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function buildCookie(name, value, { maxAgeMs, clear = false } = {}) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (config.secureCookies) attrs.push("Secure");
  if (clear) {
    attrs.push("Max-Age=0");
  } else if (maxAgeMs != null) {
    attrs.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
    attrs.push(`Expires=${new Date(Date.now() + maxAgeMs).toUTCString()}`);
  }
  return attrs.join("; ");
}

/**
 * Attaches `req.session` and `req.sessionId`. `req.session` is a plain object;
 * mutate it and call `req.saveSession()` to persist. A session row is created
 * lazily (only once something is stored or a user logs in) to avoid writing a
 * row for every anonymous hit.
 */
export function attachSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const signed = cookies[COOKIE_NAME];
  let sid = signed ? unsign(signed) : null;

  let record = sid ? sessionStore.get(sid) : null;
  if (!record) {
    sid = null;
  }

  req.sessionId = sid;
  req.session = record ? record.data : {};
  req.session.userId = record ? record.userId : null;

  let dirty = false;
  let pendingCookie = null;

  req._markSessionDirty = () => {
    dirty = true;
  };

  req.saveSession = () => {
    const userId = req.session.userId || null;
    // Separate stored data from the userId pointer.
    const { userId: _omit, ...data } = req.session;
    const expiresAt = new Date(Date.now() + MAX_AGE_MS).toISOString();

    if (!req.sessionId) {
      const newSid = uuid();
      sessionStore.create(newSid, { userId, data, expiresAt });
      req.sessionId = newSid;
      pendingCookie = buildCookie(COOKIE_NAME, sign(newSid), {
        maxAgeMs: MAX_AGE_MS,
      });
    } else {
      sessionStore.save(req.sessionId, { userId, data, expiresAt });
    }
    dirty = false;
  };

  req.regenerateSession = () => {
    // Used after login to prevent session fixation.
    if (req.sessionId) sessionStore.destroy(req.sessionId);
    req.sessionId = null;
    const keep = { ...req.session };
    req.session = keep;
    req.saveSession();
  };

  req.destroySession = () => {
    if (req.sessionId) sessionStore.destroy(req.sessionId);
    req.sessionId = null;
    req.session = { userId: null };
    pendingCookie = buildCookie(COOKIE_NAME, "", { clear: true });
  };

  // Flush any Set-Cookie we queued, right before headers are sent.
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = (...args) => {
    if (dirty) req.saveSession();
    if (pendingCookie) {
      const prev = res.getHeader("Set-Cookie");
      const list = prev ? (Array.isArray(prev) ? prev.slice() : [prev]) : [];
      list.push(pendingCookie);
      res.setHeader("Set-Cookie", list);
      pendingCookie = null;
    }
    return origWriteHead(...args);
  };
}

// ---- CSRF token helpers (double-submit tied to the session) ---------------
export function getCsrfToken(req) {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(24).toString("base64url");
    req._markSessionDirty();
  }
  return req.session.csrf;
}

export function verifyCsrf(req, token) {
  const expected = req.session && req.session.csrf;
  if (!expected || typeof token !== "string") return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
