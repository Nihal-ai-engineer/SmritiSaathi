import { OAuth2Client } from "google-auth-library";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { query, transaction } from "./db.js";
const random = () => randomBytes(32).toString("base64url");
const digest = (value) => createHash("sha256").update(value).digest("hex");

export function registerGoogle(
  app,
  { signed, session, authLimit, fail, envelope, credential, options, origin },
) {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const configured = Boolean(clientId && clientSecret);
  const redirect = origin + "/api/auth/google/callback";
  const client = new OAuth2Client(clientId, clientSecret, redirect);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  };
  const requireConfig = () => {
    if (!configured)
      fail(
        503,
        "Google sign-in needs the app owner’s Google OAuth credentials in the local .env file.",
      );
  };
  app.get("/api/auth/google/status", async (req) => ({
    configured,
    linked: req.user
      ? Boolean(
          (
            await query("SELECT 1 FROM google_identities WHERE user_id=$1", [
              req.user.id,
            ])
          ).rowCount,
        )
      : false,
  }));
  app.post("/api/auth/google/start", authLimit, async (req, reply) => {
    requireConfig();
    let userId = null;
    if (req.body?.link) {
      const user = signed(req),
        data = z.object({ credential }).parse(req.body);
      const row = (
        await query("SELECT password_hash FROM users WHERE id=$1", [user.id])
      ).rows[0];
      if (!(await argon2.verify(row.password_hash, data.credential)))
        fail(401, "Confirm your current password first.");
      userId = user.id;
    }
    const state = random(),
      nonce = random(),
      verifier = random();
    await query(
      "INSERT INTO google_flows(state_hash,nonce,verifier,link_user) VALUES($1,$2,$3,$4)",
      [digest(state), nonce, verifier, userId],
    );
    reply.setCookie("smriti_google_state", state, cookieOptions);
    const url = client.generateAuthUrl({
      scope: ["openid", "email"],
      state,
      nonce,
      prompt: "select_account",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    return { url };
  });
  app.get("/api/auth/google/callback", authLimit, async (req, reply) => {
    requireConfig();
    const state = req.query.state,
      stored = req.cookies.smriti_google_state;
    reply.clearCookie("smriti_google_state", { path: cookieOptions.path });
    if (
      typeof state !== "string" ||
      typeof stored !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      state.length !== stored.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(stored))
    )
      return reply.redirect(origin + "/#google-error=invalid-state");
    const flow = (
      await query(
        "DELETE FROM google_flows WHERE state_hash=$1 AND expires_at>now() RETURNING *",
        [digest(state)],
      )
    ).rows[0];
    if (!flow || req.query.error || typeof req.query.code !== "string")
      return reply.redirect(origin + "/#google-error=cancelled");
    try {
      const { tokens } = await client.getToken({
        code: req.query.code,
        codeVerifier: flow.verifier,
        redirect_uri: redirect,
      });
      if (!tokens.id_token) throw Error("Missing identity");
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const claims = ticket.getPayload();
      if (
        !claims?.sub ||
        !claims.email ||
        !claims.email_verified ||
        claims.nonce !== flow.nonce
      )
        throw Error("Invalid identity");
      const identity = (
        await query("SELECT user_id FROM google_identities WHERE subject=$1", [
          claims.sub,
        ])
      ).rows[0];
      if (flow.link_user) {
        if (identity && identity.user_id !== flow.link_user)
          return reply.redirect(origin + "/#google-error=already-linked");
        await query(
          "INSERT INTO google_identities(subject,user_id) VALUES($1,$2) ON CONFLICT(subject) DO NOTHING",
          [claims.sub, flow.link_user],
        );
        await session(reply, flow.link_user);
        return reply.redirect(origin + "/#google=linked");
      }
      if (identity) {
        await session(reply, identity.user_id);
        return reply.redirect(origin + "/#google=unlock");
      }
      const address = claims.email.toLowerCase();
      if (
        (await query("SELECT 1 FROM users WHERE email=$1", [address])).rowCount
      )
        return reply.redirect(origin + "/#google-error=link-existing");
      const setup = random();
      await query(
        "INSERT INTO google_setups(token_hash,subject,email) VALUES($1,$2,$3)",
        [digest(setup), claims.sub, address],
      );
      reply.clearCookie("smriti_session", { path: "/" });
      reply.setCookie("smriti_google_setup", setup, {
        ...cookieOptions,
        sameSite: "strict",
      });
      return reply.redirect(origin + "/#google=setup");
    } catch {
      return reply.redirect(origin + "/#google-error=failed");
    }
  });
  app.get("/api/auth/google/context", async (req) => {
    if (req.cookies.smriti_google_setup) {
      const setup = (
        await query(
          "SELECT email FROM google_setups WHERE token_hash=$1 AND expires_at>now()",
          [digest(req.cookies.smriti_google_setup)],
        )
      ).rows[0];
      if (setup) return { setup: true, email: setup.email };
    }
    const user = signed(req);
    return {
      user,
      vault: (
        await query("SELECT vault_envelope FROM users WHERE id=$1", [user.id])
      ).rows[0].vault_envelope,
    };
  });
  app.post("/api/auth/google/complete", authLimit, async (req, reply) => {
    const data = z
      .object({
        credential,
        role: z.enum(["patient", "caregiver"]),
        vault: envelope,
        recovery: envelope,
      })
      .parse(req.body);
    const setupToken = req.cookies.smriti_google_setup;
    if (!setupToken) fail(401, "Restart Google sign-in.");
    const passwordHash = await argon2.hash(data.credential, options);
    const user = await transaction(async (c) => {
      const setup = (
        await c.query(
          "DELETE FROM google_setups WHERE token_hash=$1 AND expires_at>now() RETURNING *",
          [digest(setupToken)],
        )
      ).rows[0];
      if (!setup) fail(401, "Google setup expired. Please restart.");
      const user = (
        await c.query(
          "INSERT INTO users(email,password_hash,role,vault_envelope,recovery_envelope,email_verified) VALUES($1,$2,$3,$4,$5,true) RETURNING id,email,role,email_verified",
          [setup.email, passwordHash, data.role, data.vault, data.recovery],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO google_identities(subject,user_id) VALUES($1,$2)",
        [setup.subject, user.id],
      );
      return user;
    });
    reply.clearCookie("smriti_google_setup", { path: cookieOptions.path });
    await session(reply, user.id);
    return { user };
  });
  app.post("/api/auth/google/disconnect", authLimit, async (req) => {
    const user = signed(req),
      data = z.object({ credential }).parse(req.body),
      row = (
        await query("SELECT password_hash FROM users WHERE id=$1", [user.id])
      ).rows[0];
    if (!(await argon2.verify(row.password_hash, data.credential)))
      fail(401, "Current password is incorrect.");
    await query("DELETE FROM google_identities WHERE user_id=$1", [user.id]);
    return { ok: true };
  });
}
