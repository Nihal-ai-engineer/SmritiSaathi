const idleDays = 5 * 24 * 60 * 60 * 1000;
type Saved = {
  userId: string;
  key: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  cipher: ArrayBuffer;
  expires: number;
};
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("smriti-device", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("vault");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function storage(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest,
) {
  const db = await database();
  try {
    return await new Promise<any>((resolve, reject) => {
      const tx = db.transaction("vault", mode),
        req = action(tx.objectStore("vault"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function rememberDevice(
  userId: string,
  vault: Uint8Array<ArrayBuffer>,
) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    vault,
  );
  await storage("readwrite", (s) =>
    s.put(
      { userId, key, iv, cipher, expires: Date.now() + idleDays },
      "current",
    ),
  );
}
export async function restoreDevice(userId: string) {
  const saved: Saved | undefined = await storage("readonly", (s) =>
    s.get("current"),
  );
  if (!saved || saved.userId !== userId || saved.expires <= Date.now()) {
    await forgetDevice();
    return null;
  }
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: saved.iv },
      saved.key,
      saved.cipher,
    ),
  );
}
export const forgetDevice = () =>
  storage("readwrite", (s) => s.delete("current"));
export async function touchDevice() {
  const saved: Saved | undefined = await storage("readonly", (s) =>
    s.get("current"),
  );
  if (saved) {
    saved.expires = Date.now() + idleDays;
    await storage("readwrite", (s) => s.put(saved, "current"));
  }
}
