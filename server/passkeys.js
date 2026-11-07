import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { query } from "./db.js";

export function registerPasskeys(
  app,
  { signed, verified, session, authLimit, fail, envelope, origin },
) {
  const rpID = new URL(origin).hostname;
  async function challenge(user, kind, value) {
    return (
      await query(
        "INSERT INTO challenges(user_id,kind,challenge) VALUES($1,$2,$3) RETURNING id",
        [user, kind, value],
      )
    ).rows[0].id;
  }
  async function consume(id, kind) {
    const row = (
      await query(
        "DELETE FROM challenges WHERE id=$1 AND kind=$2 AND expires_at>now() RETURNING *",
        [z.string().uuid().parse(id), kind],
      )
    ).rows[0];
    if (!row) fail(400, "Passkey request expired. Please try again.");
    return row;
  }
  app.get("/api/auth/passkeys", async (req) => ({
    items: (
      await query(
        "SELECT id,created_at,vault_envelope IS NOT NULL AS ready FROM passkeys WHERE user_id=$1",
        [signed(req).id],
      )
    ).rows,
  }));
  app.post("/api/auth/passkeys/register-options", authLimit, async (req) => {
    const user = verified(req);
    const existing = (
      await query("SELECT id FROM passkeys WHERE user_id=$1", [user.id])
    ).rows;
    if (existing.length >= 10) fail(400, "Remove an old passkey first.");
    const options = await generateRegistrationOptions({
      rpName: "SmritiSaathi",
      rpID,
      userName: user.email,
      userID: Buffer.from(user.id),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: existing.map((p) => ({ id: p.id })),
    });
    options.extensions = { prf: {} };
    return {
      options,
      challengeId: await challenge(user.id, "register", options.challenge),
    };
  });
  app.post("/api/auth/passkeys/register", authLimit, async (req) => {
    const user = verified(req),
      pending = await consume(req.body.challengeId, "register");
    if (pending.user_id !== user.id) fail(403, "Passkey account mismatch.");
    const result = await verifyRegistrationResponse({
      response: req.body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo)
      fail(400, "Passkey could not be verified.");
    const c = result.registrationInfo.credential;
    await query(
      "INSERT INTO passkeys(id,user_id,public_key,counter,transports,salt) VALUES($1,$2,$3,$4,$5,$6)",
      [
        c.id,
        user.id,
        Buffer.from(c.publicKey),
        c.counter,
        JSON.stringify(c.transports || []),
        randomBytes(32).toString("base64url"),
      ],
    );
    return { id: c.id };
  });
  app.post("/api/auth/passkeys/options", authLimit, async (req) => {
    const data = z
      .object({ email: z.email(), id: z.string().optional() })
      .parse(req.body);
    const rows = (
      await query(
        "SELECT p.* FROM passkeys p JOIN users u ON u.id=p.user_id WHERE u.email=$1 AND ($2::text IS NULL OR p.id=$2)",
        [data.email.trim().toLowerCase(), data.id || null],
      )
    ).rows.filter((p) => p.vault_envelope || req.user?.id === p.user_id);
    if (!rows.length)
      fail(400, "No usable passkey. Please sign in with your password.");
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: rows.map((p) => ({
        id: p.id,
        transports: p.transports,
      })),
    });
    return {
      options,
      salts: Object.fromEntries(rows.map((p) => [p.id, p.salt])),
      challengeId: await challenge(
        rows[0].user_id,
        "authenticate",
        options.challenge,
      ),
    };
  });
  app.post("/api/auth/passkeys/authenticate", authLimit, async (req, reply) => {
    const pending = await consume(req.body.challengeId, "authenticate");
    const p = (
      await query("SELECT * FROM passkeys WHERE id=$1 AND user_id=$2", [
        req.body.response?.id,
        pending.user_id,
      ])
    ).rows[0];
    if (!p) fail(400, "Unknown passkey.");
    const result = await verifyAuthenticationResponse({
      response: req.body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: p.id,
        publicKey: new Uint8Array(p.public_key),
        counter: Number(p.counter),
        transports: p.transports,
      },
      requireUserVerification: true,
    });
    if (!result.verified) fail(401, "Passkey verification failed.");
    // An initial vault envelope may only be attached from an already signed-in owner.
    if (req.body.vault) {
      if (signed(req).id !== p.user_id)
        fail(403, "Sign in with your password first.");
      await query("UPDATE passkeys SET vault_envelope=$1 WHERE id=$2", [
        envelope.parse(req.body.vault),
        p.id,
      ]);
    } else if (!p.vault_envelope)
      fail(400, "This passkey has not been set up to unlock your vault.");
    await query("UPDATE passkeys SET counter=$1 WHERE id=$2", [
      result.authenticationInfo.newCounter,
      p.id,
    ]);
    const user = (
      await query(
        "SELECT id,email,role,email_verified FROM users WHERE id=$1",
        [p.user_id],
      )
    ).rows[0];
    await session(reply, user.id);
    return { user, vault: p.vault_envelope };
  });
  app.delete("/api/auth/passkeys/:id", async (req) => {
    await query("DELETE FROM passkeys WHERE id=$1 AND user_id=$2", [
      req.params.id,
      signed(req).id,
    ]);
    return { ok: true };
  });
}
