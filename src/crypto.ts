export type Cipher = { v: 1; iv: string; data: string; salt?: string };
const enc = new TextEncoder();
const dec = new TextDecoder();
export const to64 = (data: Uint8Array): string => {
  let text = "";
  for (const byte of data) text += String.fromCharCode(byte);
  return btoa(text);
};
export const from64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (x) => x.charCodeAt(0));
export const newKey = () => crypto.getRandomValues(new Uint8Array(32));
const importKey = (raw: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
      material,
      256,
    ),
  );
}
// Authentication and vault encryption use different salts and domains. The server
// receives only the derived authentication credential, never the original password.
export async function authCredential(email: string, password: string) {
  const bytes = await derive(
    password,
    enc.encode(`smritisaathi:auth:v1:${email.trim().toLowerCase()}`),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function encryptBytes(
  key: Uint8Array<ArrayBuffer>,
  bytes: Uint8Array<ArrayBuffer>,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode("smriti:v1") },
      await importKey(key),
      bytes,
    ),
  );
  const packed = new Uint8Array(iv.length + data.length);
  packed.set(iv);
  packed.set(data, 12);
  return packed;
}
export async function decryptBytes(
  key: Uint8Array<ArrayBuffer>,
  bytes: Uint8Array<ArrayBuffer>,
) {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(0, 12),
        additionalData: enc.encode("smriti:v1"),
      },
      await importKey(key),
      bytes.slice(12),
    ),
  );
}
export async function seal(
  key: Uint8Array<ArrayBuffer>,
  value: unknown,
): Promise<Cipher> {
  const bytes = await encryptBytes(key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: to64(bytes.slice(0, 12)), data: to64(bytes.slice(12)) };
}
export async function unseal<T = any>(
  key: Uint8Array<ArrayBuffer>,
  value: Cipher,
): Promise<T> {
  const iv = from64(value.iv),
    data = from64(value.data),
    bytes = new Uint8Array(iv.length + data.length);
  bytes.set(iv);
  bytes.set(data, iv.length);
  return JSON.parse(dec.decode(await decryptBytes(key, bytes)));
}
export async function wrapVault(
  password: string,
  vault: Uint8Array<ArrayBuffer>,
): Promise<Cipher> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    ...(await seal(await derive(password, salt), to64(vault))),
    salt: to64(salt),
  };
}
export async function unlockVault(password: string, wrapped: Cipher) {
  if (!wrapped.salt) throw new Error("Invalid vault.");
  return from64(
    await unseal<string>(await derive(password, from64(wrapped.salt)), wrapped),
  );
}
