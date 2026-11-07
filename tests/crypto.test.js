import test from "node:test";
import assert from "node:assert/strict";
import {
  newKey,
  wrapVault,
  unlockVault,
  seal,
  unseal,
  authCredential,
} from "../src/crypto.ts";
test("eight-character passwords wrap and unlock the vault", async () => {
  const key = newKey(),
    wrapped = await wrapVault("test1234", key);
  assert.deepEqual(await unlockVault("test1234", wrapped), key);
  await assert.rejects(() => unlockVault("wrong123", wrapped));
  const saved = await seal(key, { caption: "Private test content" });
  assert.equal((await unseal(key, saved)).caption, "Private test content");
  await assert.rejects(() => unseal(newKey(), saved));
  const auth = await authCredential("qa@example.invalid", "test1234");
  assert.equal(auth.length, 64);
  assert.notEqual(auth, Buffer.from(key).toString("hex"));
});
