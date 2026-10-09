// auth.js — Google OAuth 2.0 (Authorization Code + PKCE), hand-rolled.
//
// No `passport`. The flow:
//   1) /auth/google          -> build state + PKCE, stash in session, redirect
//   2) /auth/google/callback -> verify state, swap code for tokens, read the
//                               userinfo endpoint, upsert the user, log them in.
//
// If Google credentials are not configured the app still runs; the login
// routes return a friendly "not configured" page instead of crashing.

import crypto from "node:crypto";
import config from "./config.js";
import { upsertGoogleUser } from "./db.js";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

function base64url(buf) {
  return buf.toString("base64url");
}

function pkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest()
  );
  return { verifier, challenge };
}

export function isConfigured() {
  return config.google.configured;
}

/** Step 1: redirect the user to Google's consent screen. */
export function startGoogleLogin(req, res, helpers) {
  if (!config.google.configured) {
    return helpers.renderNotConfigured(res);
  }

  const state = base64url(crypto.randomBytes(16));
  const nonce = base64url(crypto.randomBytes(16));
  const { verifier, challenge } = pkcePair();

  // Stash the one-time values in the session so the callback can verify them.
  req.session.oauth = { state, nonce, verifier, ts: Date.now() };
  // Remember where to send the user after login (optional ?next=).
  const next = typeof req.query.next === "string" ? req.query.next : "/library";
  req.session.oauth.next = next.startsWith("/") ? next : "/library";
  req.saveSession();

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  helpers.redirect(res, `${AUTH_ENDPOINT}?${params.toString()}`);
}

/** Step 2: handle Google's redirect back to us. */
export async function handleGoogleCallback(req, res, helpers) {
  if (!config.google.configured) {
    return helpers.renderNotConfigured(res);
  }

  const { code, state, error } = req.query;
  const stash = req.session.oauth;

  if (error) {
    return helpers.renderAuthError(res, `Google returned: ${error}`);
  }
  if (!stash || !state || state !== stash.state) {
    return helpers.renderAuthError(
      res,
      "Login session expired or state mismatch. Please try signing in again."
    );
  }
  // One-time use: clear the stash immediately.
  delete req.session.oauth;
  req.saveSession();

  if (!code) {
    return helpers.renderAuthError(res, "Missing authorization code.");
  }

  // Exchange the code for tokens.
  let tokenData;
  try {
    const body = new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code: String(code),
      code_verifier: stash.verifier,
      grant_type: "authorization_code",
      redirect_uri: config.google.redirectUri,
    });
    const r = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    tokenData = await r.json();
    if (!r.ok) {
      throw new Error(
        tokenData.error_description || tokenData.error || `HTTP ${r.status}`
      );
    }
  } catch (e) {
    return helpers.renderAuthError(
      res,
      "Could not exchange the login code with Google: " + e.message
    );
  }

  // Fetch the verified profile from the userinfo endpoint.
  let profile;
  try {
    const r = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    profile = await r.json();
    if (!r.ok || !profile.sub) {
      throw new Error(profile.error || `HTTP ${r.status}`);
    }
  } catch (e) {
    return helpers.renderAuthError(
      res,
      "Could not read your Google profile: " + e.message
    );
  }

  // Create/update the account and log in. Regenerate the session id to prevent
  // session fixation.
  const user = upsertGoogleUser({
    sub: profile.sub,
    email: profile.email,
    email_verified: profile.email_verified,
    name: profile.name,
    picture: profile.picture,
  });

  req.session.userId = user.id;
  req.regenerateSession();

  const dest = stash.next && stash.next.startsWith("/") ? stash.next : "/library";
  helpers.redirect(res, dest);
}

export function logout(req, res, helpers) {
  req.destroySession();
  helpers.redirect(res, "/");
}
