// localauth.js — email + password accounts, hashed with Node's built-in
// scrypt (no external crypto library). Works immediately, no setup required.

import crypto from "node:crypto";
import { createLocalUser, getUserByEmail, touchLogin } from "./db.js";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN)
    .toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.startsWith("scrypt$")) {
    return false;
  }
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const a = Buffer.from(hash, "hex");
  if (a.length !== derived.length) return false;
  return crypto.timingSafeEqual(a, derived);
}

function validEmail(email) {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validUsername(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

/** Finalize a successful auth: set the session user and rotate the session id. */
function logIn(req, user) {
  req.session.userId = user.id;
  req.regenerateSession();
  touchLogin(user.id);
}

/**
 * POST /auth/signup — create an account and sign in.
 * helpers.renderLogin(res, { mode, error, values }) re-renders the page.
 */
export function handleSignup(req, res, body, helpers) {
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const username = (body.username || "").trim();
  const name = (body.name || "").trim() || username;

  const keep = { email, username, name: body.name };

  if (!validUsername(username)) {
    return helpers.renderLogin(res, {
      mode: "signup",
      error: "Username must be 3–20 letters, numbers or underscores.",
      values: keep,
    });
  }
  if (!validEmail(email)) {
    return helpers.renderLogin(res, {
      mode: "signup",
      error: "Enter a valid email address.",
      values: keep,
    });
  }
  if (password.length < 8) {
    return helpers.renderLogin(res, {
      mode: "signup",
      error: "Password must be at least 8 characters.",
      values: keep,
    });
  }

  let user;
  try {
    user = createLocalUser({
      username,
      email,
      name,
      passwordHash: hashPassword(password),
    });
  } catch (e) {
    if (e.code === "EMAIL_TAKEN") {
      return helpers.renderLogin(res, {
        mode: "login",
        error: "An account with that email already exists. Log in instead.",
        values: { email },
      });
    }
    if (e.code === "USERNAME_TAKEN") {
      return helpers.renderLogin(res, {
        mode: "signup",
        error: "That username is taken. Pick another.",
        values: keep,
      });
    }
    throw e;
  }

  logIn(req, user);
  helpers.redirect(res, "/");
}

/** POST /auth/login — verify credentials and sign in. */
export function handleLogin(req, res, body, helpers) {
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = getUserByEmail(email);
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return helpers.renderLogin(res, {
      mode: "login",
      error: "Email or password is incorrect.",
      values: { email },
    });
  }

  logIn(req, user);
  helpers.redirect(res, "/");
}
