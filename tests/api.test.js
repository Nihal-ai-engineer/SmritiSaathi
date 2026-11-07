import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { buildApp } from "../server/app.js";
import { query, pool } from "../server/db.js";

test("Account isolation, ciphertext persistence and five-day sessions", async (t) => {
  const app = await buildApp({ logger: false });
  const ids = [];
  const headers = { origin: process.env.APP_ORIGIN, "x-smriti-client": "1" };
  const cipher = {
    v: 1,
    iv: randomBytes(12).toString("base64"),
    data: randomBytes(40).toString("base64"),
  };
  const cred = randomBytes(32).toString("hex");
  async function request(method, url, body, cookie) {
    return app.inject({
      method,
      url: "/api" + url,
      headers: { ...headers, ...(cookie ? { cookie } : {}) },
      ...(body ? { payload: body } : {}),
    });
  }
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      assert.equal(
        (await request("GET", "/auth/google/status")).json().configured,
        false,
      );
      assert.equal(
        (await request("POST", "/auth/google/start", {})).statusCode,
        503,
      );
    }
    assert.equal(
      (await request("GET", "/auth/google/context")).statusCode,
      401,
    );
    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {},
    });
    assert.equal(blocked.statusCode, 403);
    let r = await request("POST", "/auth/register", {
      email: `test-${randomBytes(8).toString("hex")}@example.invalid`,
      credential: cred,
      role: "caregiver",
      vault: cipher,
      recovery: cipher,
    });
    assert.equal(r.statusCode, 200, r.body);
    const first = r.json().user;
    ids.push(first.id);
    let cookie = r.cookies[0].name + "=" + r.cookies[0].value;
    assert.equal(r.cookies[0].maxAge, 432000);
    assert.equal(
      (await request("GET", "/profiles", null, cookie)).statusCode,
      403,
    );
    const stored = (
      await query("SELECT password_hash FROM users WHERE id=$1", [first.id])
    ).rows[0];
    assert.match(stored.password_hash, /^\$argon2id\$/);
    assert.ok(!stored.password_hash.includes(cred));
    await query("UPDATE users SET email_verified=true WHERE id=$1", [first.id]);
    r = await request(
      "POST",
      "/profiles",
      { payload: cipher, keyEnvelope: cipher, consent: "care-consent-v1" },
      cookie,
    );
    assert.equal(r.statusCode, 200, r.body);
    const profile = r.json().id;
    r = await request(
      "POST",
      `/profiles/${profile}/records`,
      { kind: "person", payload: cipher },
      cookie,
    );
    assert.equal(r.statusCode, 200, r.body);
    const record = r.json().id;
    const listed = (
      await request(
        "GET",
        `/profiles/${profile}/records?kind=person`,
        null,
        cookie,
      )
    ).json();
    assert.deepEqual(listed.items[0].payload, cipher);
    assert.equal(
      (
        await request(
          "PUT",
          `/profiles/${profile}/records/${record}`,
          { version: 1, payload: cipher },
          cookie,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await request(
          "PUT",
          `/profiles/${profile}/records/${record}`,
          { version: 1, payload: cipher },
          cookie,
        )
      ).statusCode,
      409,
    );
    r = await request("POST", "/auth/register", {
      email: `test-${randomBytes(8).toString("hex")}@example.invalid`,
      credential: cred,
      role: "patient",
      vault: cipher,
      recovery: cipher,
    });
    assert.equal(r.statusCode, 200, r.body);
    ids.push(r.json().user.id);
    const other = r.cookies[0].name + "=" + r.cookies[0].value;
    await query("UPDATE users SET email_verified=true WHERE id=$1", [ids[1]]);
    assert.equal(
      (
        await request(
          "GET",
          `/profiles/${profile}/records?kind=person`,
          null,
          other,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await request(
          "DELETE",
          `/profiles/${profile}/records/${record}`,
          null,
          other,
        )
      ).statusCode,
      404,
    );
    await query(
      "UPDATE sessions SET expires_at=now()+interval '1 day',last_seen=now()-interval '4 days' WHERE user_id=$1",
      [first.id],
    );
    assert.ok((await request("GET", "/auth/me", null, cookie)).json().user);
    assert.ok(
      Number(
        (
          await query(
            "SELECT EXTRACT(EPOCH FROM expires_at-now()) AS seconds FROM sessions WHERE user_id=$1",
            [first.id],
          )
        ).rows[0].seconds,
      ) > 431900,
    );
    await query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [first.id],
    );
    assert.equal(
      (await request("GET", "/auth/me", null, cookie)).json().user,
      null,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/profiles/${profile}/records?kind=person`,
          null,
          cookie,
        )
      ).statusCode,
      401,
    );
    r = await request("POST", "/auth/login", {
      email: first.email,
      credential: cred,
    });
    assert.equal(r.statusCode, 200, r.body);
    cookie = r.cookies[0].name + "=" + r.cookies[0].value;
    assert.equal(
      (
        await request(
          "POST",
          "/auth/passkeys/authenticate",
          { challengeId: "00000000-0000-4000-8000-000000000000", response: {} },
          cookie,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/auth/delete-account",
          { credential: cred, confirmation: "DELETE" },
          cookie,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (await query("SELECT id FROM profiles WHERE id=$1", [profile])).rowCount,
      0,
    );
    assert.equal(
      (await request("GET", "/auth/me", null, cookie)).json().user,
      null,
    );
    await t.test("verification email delivered to local inbox", async () => {
      const inbox = await fetch("http://127.0.0.1:58025/api/v1/messages").then(
        (r) => r.json(),
      );
      assert.ok(
        inbox.messages.some((m) => m.To.some((p) => p.Address === first.email)),
      );
    });
  } finally {
    for (const id of ids) {
      await query(
        "DELETE FROM records WHERE profile_id IN(SELECT id FROM profiles WHERE owner_id=$1)",
        [id],
      );
      await query("DELETE FROM profiles WHERE owner_id=$1", [id]);
      await query("DELETE FROM audit_events WHERE user_id=$1", [id]);
      await query("DELETE FROM users WHERE id=$1", [id]);
    }
    await app.close();
    await pool.end();
  }
});
