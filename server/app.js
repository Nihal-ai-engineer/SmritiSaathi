import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import Redis from "ioredis";
import argon2 from "argon2";
import nodemailer from "nodemailer";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { registerPasskeys } from "./passkeys.js";
import { registerGoogle } from "./google.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("hex");
const uuid = z.string().uuid();
const b64 = z.string().regex(/^[A-Za-z0-9+/]+=*$/);
const envelope = z
  .object({
    v: z.literal(1),
    iv: b64.length(16),
    data: b64.min(24).max(100000),
    salt: b64.optional(),
  })
  .strict();
const credential = z.string().regex(/^[a-f0-9]{64}$/);
const email = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase());
const kinds = z.enum(["memory", "person", "reminder", "practice", "health"]);
const options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
const uploads = path.resolve(process.env.UPLOAD_DIR || ".data/uploads");
const mail = nodemailer.createTransport(
  process.env.SMTP_URL || "smtp://127.0.0.1:51025",
);
function fail(status, message) {
  throw Object.assign(new Error(message), { statusCode: status });
}
async function audit(user, profile, action) {
  await query(
    "INSERT INTO audit_events(user_id,profile_id,action) VALUES($1,$2,$3)",
    [user, profile, action],
  );
}
async function sendMail(address, subject, text) {
  await mail.sendMail({
    from: process.env.MAIL_FROM || "care@smritisaathi.local",
    to: address,
    subject,
    text,
  });
}
async function issueToken(user, kind, address) {
  const value = token();
  await query(
    "INSERT INTO action_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(value), user, kind],
  );
  try {
    await sendMail(
      address,
      kind === "verify"
        ? "Verify your SmritiSaathi email"
        : "Reset your SmritiSaathi password",
      `Open this link within one hour:\n${origin}/#${kind}=${value}\n\nIf you did not request this, ignore this email. Never share your recovery key with support.`,
    );
  } catch (error) {
    await query("DELETE FROM action_tokens WHERE token_hash=$1", [hash(value)]);
    throw error;
  }
}

export async function buildApp({ logger = true } = {}) {
  const app = Fastify({
    logger: logger
      ? {
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            "res.headers.set-cookie",
          ],
        }
      : false,
    disableRequestLogging: true,
    bodyLimit: 150000,
  });
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      })
    : undefined;
  if (
    process.env.NODE_ENV === "production" &&
    (!redis || !origin.startsWith("https://") || !process.env.SMTP_URL)
  )
    throw new Error("Production requires HTTPS APP_ORIGIN, Redis and SMTP.");
  const dummyHash = await argon2.hash(token(), options);
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "blob:", "data:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: [
          "'self'",
          "https://huggingface.co",
          "https://*.huggingface.co",
          "https://*.hf.co",
          "https://raw.githubusercontent.com",
          "ws://localhost:5173",
        ],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: "1 minute",
    ...(redis ? { redis } : {}),
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        req.headers.origin !== origin ||
        req.headers["x-smriti-client"] !== "1"
      )
        fail(403, `This app address is not allowed. Open ${origin}, refresh, and try again.`);
    }
    const value = req.cookies.smriti_session;
    if (value && /^[a-f0-9]{64}$/.test(value)) {
      req.user =
        (
          await query(
            "SELECT u.id,u.email,u.role,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now()",
            [hash(value)],
          )
        ).rows[0] || null;
      if (req.user) {
        await query(
          "UPDATE sessions SET last_seen=now(),expires_at=now()+interval '5 days' WHERE token_hash=$1",
          [hash(value)],
        );
        reply.setCookie("smriti_session", value, {
          httpOnly: true,
          secure: origin.startsWith("https://"),
          sameSite: "strict",
          path: "/",
          maxAge: 432000,
        });
      }
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({ error: "Please check the information you entered." });
    const status = error.statusCode || (error.code === "23505" ? 409 : 500);
    if (status >= 500)
      app.log.error(
        { code: error.code, errorType: error.name },
        "Request failed",
      );
    reply.code(status).send({
      error:
        status >= 500
          ? "Could not save right now. Please try again."
          : error.code === "23505"
            ? "This request conflicts with an existing record."
            : error.message,
    });
  });
  function signed(req) {
    if (!req.user) fail(401, "Please sign in.");
    return req.user;
  }
  function verified(req) {
    const user = signed(req);
    if (!user.email_verified) fail(403, "Verify your email to continue.");
    return user;
  }
  async function member(req, owner = false) {
    const user = verified(req);
    const id = uuid.parse(req.params.profileId);
    const row = (
      await query(
        "SELECT role FROM memberships WHERE profile_id=$1 AND user_id=$2",
        [id, user.id],
      )
    ).rows[0];
    if (!row || (owner && row.role !== "owner"))
      fail(404, "Care profile not found.");
    return { id, user, role: row.role };
  }
  async function session(reply, userId) {
    const value = token();
    await query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '5 days')",
      [hash(value), userId],
    );
    reply.setCookie("smriti_session", value, {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "strict",
      path: "/",
      maxAge: 432000,
    });
  }
  const authLimit = {
    config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
  };
  registerPasskeys(app, {
    signed,
    verified,
    session,
    authLimit,
    fail,
    envelope,
    origin,
  });
  registerGoogle(app, {
    signed,
    session,
    authLimit,
    fail,
    envelope,
    credential,
    options,
    origin,
  });
  app.get("/api/health", async () => {
    await query("SELECT 1");
    return { status: "ok" };
  });
  app.post("/api/auth/register", authLimit, async (req, reply) => {
    const data = z
      .object({
        email,
        credential,
        role: z.enum(["patient", "caregiver"]),
        vault: envelope,
        recovery: envelope,
      })
      .parse(req.body);
    if (
      (await query("SELECT id FROM users WHERE email=$1", [data.email]))
        .rowCount
    )
      fail(
        400,
        "Unable to create account. Try signing in or recovering your account.",
      );
    const passwordHash = await argon2.hash(data.credential, options);
    const user = (
      await query(
        "INSERT INTO users(email,password_hash,role,vault_envelope,recovery_envelope) VALUES($1,$2,$3,$4,$5) RETURNING id,email,role,email_verified",
        [data.email, passwordHash, data.role, data.vault, data.recovery],
      )
    ).rows[0];
    let mailSent = true;
    try {
      await issueToken(user.id, "verify", user.email);
    } catch {
      mailSent = false;
    }
    await session(reply, user.id);
    return { user, mailSent };
  });
  app.post("/api/auth/login", authLimit, async (req, reply) => {
    const data = z.object({ email, credential }).parse(req.body);
    const user = (
      await query("SELECT * FROM users WHERE email=$1", [data.email])
    ).rows[0];
    const valid = await argon2.verify(
      user?.password_hash || dummyHash,
      data.credential,
    );
    if (!user || !valid) fail(401, "Email or password is incorrect.");
    await session(reply, user.id);
    await audit(user.id, null, "login");
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
      },
      vault: user.vault_envelope,
    };
  });
  app.get("/api/auth/me", async (req) => ({ user: req.user }));
  app.post("/api/auth/activity", async (req) => {
    signed(req);
    return { ok: true };
  });
  app.post("/api/auth/password", authLimit, async (req, reply) => {
    const user = signed(req),
      data = z
        .object({ current: credential, credential, vault: envelope })
        .parse(req.body);
    const row = (
      await query("SELECT password_hash FROM users WHERE id=$1", [user.id])
    ).rows[0];
    if (!(await argon2.verify(row.password_hash, data.current)))
      fail(401, "Current password is incorrect.");
    const nextHash = await argon2.hash(data.credential, options);
    await transaction(async (client) => {
      await client.query(
        "UPDATE users SET password_hash=$1,vault_envelope=$2 WHERE id=$3",
        [nextHash, data.vault, user.id],
      );
      await client.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    });
    await session(reply, user.id);
    return { ok: true };
  });
  app.post("/api/auth/delete-account", authLimit, async (req, reply) => {
    const user = signed(req),
      data = z
        .object({ credential, confirmation: z.literal("DELETE") })
        .parse(req.body);
    const row = (
      await query("SELECT password_hash FROM users WHERE id=$1", [user.id])
    ).rows[0];
    if (!(await argon2.verify(row.password_hash, data.credential)))
      fail(401, "Password is incorrect.");
    const files = (
      await query(
        "SELECT storage_key FROM photos WHERE profile_id IN (SELECT id FROM profiles WHERE owner_id=$1)",
        [user.id],
      )
    ).rows;
    await transaction(async (client) => {
      await client.query(
        "DELETE FROM records WHERE profile_id IN (SELECT id FROM profiles WHERE owner_id=$1)",
        [user.id],
      );
      await client.query("DELETE FROM profiles WHERE owner_id=$1", [user.id]);
      await client.query("DELETE FROM audit_events WHERE user_id=$1", [
        user.id,
      ]);
      await client.query("DELETE FROM users WHERE id=$1", [user.id]);
    });
    for (const f of files)
      await unlink(path.join(uploads, f.storage_key)).catch(() => {});
    reply.clearCookie("smriti_session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    if (req.cookies.smriti_session)
      await query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.cookies.smriti_session),
      ]);
    reply.clearCookie("smriti_session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/auth/logout-all", async (req) => {
    await query("DELETE FROM sessions WHERE user_id=$1", [signed(req).id]);
    return { ok: true };
  });
  app.post("/api/auth/resend", authLimit, async (req) => {
    const user = signed(req);
    if (!user.email_verified) await issueToken(user.id, "verify", user.email);
    return { ok: true };
  });
  app.post("/api/auth/verify", authLimit, async (req) => {
    const value = z.object({ token: credential }).parse(req.body).token;
    await transaction(async (client) => {
      const row = (
        await client.query(
          "DELETE FROM action_tokens WHERE token_hash=$1 AND kind='verify' AND expires_at>now() RETURNING user_id",
          [hash(value)],
        )
      ).rows[0];
      if (!row)
        fail(400, "This verification link has expired or was already used.");
      await client.query("UPDATE users SET email_verified=true WHERE id=$1", [
        row.user_id,
      ]);
    });
    return { ok: true };
  });
  app.post("/api/auth/forgot", authLimit, async (req) => {
    const address = z.object({ email }).parse(req.body).email;
    const user = (await query("SELECT id FROM users WHERE email=$1", [address]))
      .rows[0];
    if (user) {
      try {
        await issueToken(user.id, "reset", address);
      } catch {
        app.log.warn("Recovery email unavailable");
      }
    }
    return {
      message: "If this account exists, a recovery link has been sent.",
    };
  });
  app.post("/api/auth/recovery-info", authLimit, async (req) => {
    const value = z.object({ token: credential }).parse(req.body).token;
    const row = (
      await query(
        "SELECT u.email,u.recovery_envelope FROM action_tokens t JOIN users u ON u.id=t.user_id WHERE token_hash=$1 AND kind='reset' AND expires_at>now()",
        [hash(value)],
      )
    ).rows[0];
    if (!row) fail(400, "This recovery link is invalid or expired.");
    return row;
  });
  app.post("/api/auth/reset", authLimit, async (req) => {
    const data = z
      .object({ token: credential, credential, vault: envelope })
      .parse(req.body);
    const passwordHash = await argon2.hash(data.credential, options);
    await transaction(async (client) => {
      const row = (
        await client.query(
          "DELETE FROM action_tokens WHERE token_hash=$1 AND kind='reset' AND expires_at>now() RETURNING user_id",
          [hash(data.token)],
        )
      ).rows[0];
      if (!row) fail(400, "This recovery link is invalid or expired.");
      await client.query(
        "UPDATE users SET password_hash=$1,vault_envelope=$2 WHERE id=$3",
        [passwordHash, data.vault, row.user_id],
      );
      await client.query("DELETE FROM sessions WHERE user_id=$1", [
        row.user_id,
      ]);
      await client.query("DELETE FROM passkeys WHERE user_id=$1", [
        row.user_id,
      ]);
      await client.query(
        "DELETE FROM action_tokens WHERE user_id=$1 AND kind='reset'",
        [row.user_id],
      );
    });
    return { ok: true };
  });
  app.get("/api/profiles", async (req) => {
    const user = verified(req);
    return {
      items: (
        await query(
          "SELECT p.id,p.payload,m.role,m.key_envelope FROM memberships m JOIN profiles p ON p.id=m.profile_id WHERE m.user_id=$1 ORDER BY p.created_at LIMIT 50",
          [user.id],
        )
      ).rows,
    };
  });
  app.post("/api/profiles", async (req) => {
    const user = verified(req);
    const data = z
      .object({
        payload: envelope,
        keyEnvelope: envelope,
        consent: z.literal("care-consent-v1"),
      })
      .parse(req.body);
    return transaction(async (client) => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user.id,
      ]);
      if (
        Number(
          (
            await client.query(
              "SELECT count(*) FROM profiles WHERE owner_id=$1",
              [user.id],
            )
          ).rows[0].count,
        ) >= 10
      )
        fail(400, "You can manage up to 10 care profiles.");
      const profile = (
        await client.query(
          "INSERT INTO profiles(owner_id,payload,consent_version) VALUES($1,$2,$3) RETURNING id",
          [user.id, data.payload, data.consent],
        )
      ).rows[0];
      await client.query(
        "INSERT INTO memberships(profile_id,user_id,role,key_envelope) VALUES($1,$2,'owner',$3)",
        [profile.id, user.id, data.keyEnvelope],
      );
      return profile;
    });
  });
  app.put("/api/profiles/:profileId", async (req) => {
    const access = await member(req, true);
    const data = z.object({ payload: envelope }).parse(req.body);
    await query("UPDATE profiles SET payload=$1 WHERE id=$2", [
      data.payload,
      access.id,
    ]);
    return { ok: true };
  });
  app.get("/api/profiles/:profileId/records", async (req) => {
    const { id } = await member(req);
    const data = z
      .object({
        kind: kinds,
        cursor: uuid.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);
    const rows = (
      await query(
        `SELECT id,payload,photo_id,version,created_at FROM records WHERE profile_id=$1 AND kind=$2
      AND ($3::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM records WHERE id=$3 AND profile_id=$1 AND kind=$2))
      ORDER BY created_at DESC,id DESC LIMIT $4`,
        [id, data.kind, data.cursor || null, data.limit + 1],
      )
    ).rows;
    const more = rows.length > data.limit;
    const items = rows.slice(0, data.limit);
    return { items, nextCursor: more ? items.at(-1).id : null };
  });
  async function checkPhoto(photo, profile) {
    if (
      photo &&
      !(
        await query("SELECT id FROM photos WHERE id=$1 AND profile_id=$2", [
          photo,
          profile,
        ])
      ).rowCount
    )
      fail(400, "Photo does not belong to this care profile.");
  }
  app.post("/api/profiles/:profileId/records", async (req) => {
    const access = await member(req);
    const data = z
      .object({
        kind: kinds,
        payload: envelope,
        photoId: uuid.nullable().optional(),
      })
      .parse(req.body);
    await checkPhoto(data.photoId, access.id);
    if (data.kind === "memory" && !data.photoId)
      fail(400, "Please add a photo.");
    const row = (
      await query(
        "INSERT INTO records(profile_id,kind,payload,photo_id) VALUES($1,$2,$3,$4) RETURNING id,version,created_at",
        [access.id, data.kind, data.payload, data.photoId || null],
      )
    ).rows[0];
    await audit(access.user.id, access.id, `create:${data.kind}`);
    return row;
  });
  app.put("/api/profiles/:profileId/records/:id", async (req) => {
    const access = await member(req);
    const id = uuid.parse(req.params.id);
    const data = z
      .object({ payload: envelope, version: z.number().int().positive() })
      .parse(req.body);
    const row = (
      await query(
        "UPDATE records SET payload=$1,version=version+1,updated_at=now() WHERE id=$2 AND profile_id=$3 AND version=$4 RETURNING version",
        [data.payload, id, access.id, data.version],
      )
    ).rows[0];
    if (!row) fail(409, "This item changed. Refresh and try again.");
    await audit(access.user.id, access.id, "update:record");
    return row;
  });
  app.delete("/api/profiles/:profileId/records/:id", async (req) => {
    const access = await member(req);
    const id = uuid.parse(req.params.id);
    const removed = await query(
      "DELETE FROM records WHERE id=$1 AND profile_id=$2",
      [id, access.id],
    );
    if (!removed.rowCount) fail(404, "Item not found.");
    await audit(access.user.id, access.id, "delete:record");
    return { ok: true };
  });
  app.post(
    "/api/profiles/:profileId/photos",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const access = await member(req);
      const file = await req.file();
      if (!file || file.mimetype !== "application/octet-stream")
        fail(400, "An encrypted photo is required.");
      const bytes = await file.toBuffer();
      if (file.file.truncated || bytes.length < 29)
        fail(400, "Photo is incomplete or too large.");
      await mkdir(uploads, { recursive: true, mode: 0o700 });
      const key = token() + ".enc";
      await writeFile(path.join(uploads, key), bytes, {
        mode: 0o600,
        flag: "wx",
      });
      try {
        return (
          await query(
            "INSERT INTO photos(profile_id,storage_key,bytes) VALUES($1,$2,$3) RETURNING id",
            [access.id, key, bytes.length],
          )
        ).rows[0];
      } catch (error) {
        await unlink(path.join(uploads, key));
        throw error;
      }
    },
  );
  app.get("/api/profiles/:profileId/photos/:id", async (req, reply) => {
    const access = await member(req);
    const id = uuid.parse(req.params.id);
    const photo = (
      await query(
        "SELECT storage_key FROM photos WHERE id=$1 AND profile_id=$2",
        [id, access.id],
      )
    ).rows[0];
    if (!photo) fail(404, "Photo not found.");
    reply
      .header("Content-Type", "application/octet-stream")
      .header("X-Content-Type-Options", "nosniff");
    return readFile(path.join(uploads, photo.storage_key));
  });
  app.get("/api/profiles/:profileId/team", async (req) => {
    const access = await member(req);
    return {
      items: (
        await query(
          "SELECT u.id,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE profile_id=$1",
          [access.id],
        )
      ).rows,
    };
  });
  app.post("/api/profiles/:profileId/invite", authLimit, async (req) => {
    const access = await member(req, true);
    const address = z.object({ email }).parse(req.body).email;
    const value = token();
    await query(
      "INSERT INTO action_tokens(token_hash,kind,email,profile_id,expires_at) VALUES($1,'invite',$2,$3,now()+interval '24 hours')",
      [hash(value), address, access.id],
    );
    await audit(access.user.id, access.id, "create:invitation");
    return { token: value };
  });
  app.post("/api/invitations/accept", authLimit, async (req) => {
    const user = verified(req);
    const data = z
      .object({ token: credential, keyEnvelope: envelope })
      .parse(req.body);
    return transaction(async (client) => {
      const row = (
        await client.query(
          "DELETE FROM action_tokens WHERE token_hash=$1 AND kind='invite' AND email=$2 AND expires_at>now() RETURNING profile_id",
          [hash(data.token), user.email],
        )
      ).rows[0];
      if (!row)
        fail(
          400,
          "Invitation is invalid, expired or belongs to another email.",
        );
      await client.query(
        "INSERT INTO memberships(profile_id,user_id,role,key_envelope) VALUES($1,$2,'caregiver',$3) ON CONFLICT DO NOTHING",
        [row.profile_id, user.id, data.keyEnvelope],
      );
      return { profileId: row.profile_id };
    });
  });
  app.delete("/api/profiles/:profileId/team/:id", async (req) => {
    const access = await member(req, true);
    const id = uuid.parse(req.params.id);
    await query(
      "DELETE FROM memberships WHERE profile_id=$1 AND user_id=$2 AND role<>'owner'",
      [access.id, id],
    );
    await audit(access.user.id, access.id, "revoke:membership");
    return { ok: true };
  });
  app.get("/api/profiles/:profileId/audit", async (req) => {
    const access = await member(req, true);
    return {
      items: (
        await query(
          "SELECT action,created_at FROM audit_events WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 50",
          [access.id],
        )
      ).rows,
    };
  });
  const dist = path.resolve("dist");
  try {
    await stat(path.join(dist, "index.html"));
    await app.register(staticFiles, { root: dist });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found." })
        : reply.sendFile("index.html"),
    );
  } catch {
    /* The Vite server serves the UI during development. */
  }
  app.addHook("onClose", async () => {
    if (redis) await redis.quit();
  });
  return app;
}
