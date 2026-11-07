import {
  startRegistration,
  startAuthentication,
  base64URLStringToBuffer,
} from "@simplewebauthn/browser";
import { api } from "./api";
import { seal, unseal, to64, from64 } from "./crypto";

async function authenticate(
  email: string,
  id?: string,
  vault?: Uint8Array<ArrayBuffer>,
) {
  const request = await api("/auth/passkeys/options", "POST", { email, id });
  request.options.extensions = {
    prf: {
      evalByCredential: Object.fromEntries(
        Object.entries(request.salts).map(([key, salt]) => [
          key,
          { first: base64URLStringToBuffer(salt as string) },
        ]),
      ),
    },
  };
  const response = await startAuthentication({ optionsJSON: request.options });
  const extensions = response.clientExtensionResults as unknown as {
    prf?: { results?: { first: ArrayBuffer } };
  };
  const output = extensions.prf?.results?.first;
  if (!output)
    throw new Error(
      "This device cannot unlock encrypted data with a passkey. Please use your password.",
    );
  const key = new Uint8Array(output);
  // PRF output is a private decryption secret. Never include it in the API request.
  response.clientExtensionResults = {};
  const result = await api("/auth/passkeys/authenticate", "POST", {
    challengeId: request.challengeId,
    response,
    ...(vault ? { vault: await seal(key, to64(vault)) } : {}),
  });
  return {
    user: result.user,
    key: vault || from64(await unseal<string>(key, result.vault)),
  };
}
export async function addPasskey(
  email: string,
  vault: Uint8Array<ArrayBuffer>,
) {
  const request = await api("/auth/passkeys/register-options", "POST");
  const response = await startRegistration({ optionsJSON: request.options });
  response.clientExtensionResults = {};
  const saved = await api("/auth/passkeys/register", "POST", {
    challengeId: request.challengeId,
    response,
  });
  try {
    await authenticate(email, saved.id, vault);
  } catch (error) {
    await api(`/auth/passkeys/${encodeURIComponent(saved.id)}`, "DELETE");
    throw error;
  }
}
export const loginWithPasskey = (email: string) => authenticate(email);
