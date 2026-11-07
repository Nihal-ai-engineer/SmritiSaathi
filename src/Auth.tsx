import { translate as uiText } from "./i18n";
import LanguagePicker from "./LanguagePicker";
import { useState, useEffect } from "react";
import {
  Heart,
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  KeyRound,
} from "lucide-react";
import { loginWithPasskey } from "./passkeys";
import { api, type User } from "./api";
import {
  newKey,
  to64,
  from64,
  seal,
  unseal,
  authCredential,
  wrapVault,
  unlockVault,
} from "./crypto";

export function Brand() {
  return (
    <div className="brand">
      <span>
        <Heart fill="currentColor" size={24} />
      </span>
      <div>
        {uiText("SmritiSaathi")}
        <small>{uiText("Familiar care, rooted in Northeast India.")}</small>
      </div>
    </div>
  );
}
export default function Auth({
  onLogin,
  resetToken,
}: {
  onLogin: (user: User, key: Uint8Array<ArrayBuffer>) => void;
  resetToken?: string;
}) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [googleContext, setGoogleContext] = useState<any>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  useEffect(() => {
    void api("/auth/google/status")
      .then((r) => setGoogleConfigured(r.configured))
      .catch(() => {});
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has("google-error")) {
      setError(
        params.get("google-error") === "link-existing"
          ? "This email already has an account. Sign in with your password and connect Google in Care & privacy."
          : "Google sign-in was cancelled or could not be verified. Please try again.",
      );
      history.replaceState(null, "", location.pathname);
    }
    if (params.has("google"))
      void api("/auth/google/context")
        .then((r) => {
          setGoogleContext(r);
          setEmail(r.email || r.user.email);
          setMode(r.setup ? "google-setup" : "google-unlock");
          setMessage(
            r.setup
              ? "Google verified your email. Choose a private-space password and save the recovery key. Google does not receive this password."
              : "Google sign-in succeeded. Enter your private-space password to decrypt your memories on this device.",
          );
          history.replaceState(null, "", location.pathname);
        })
        .catch((e) => setError(e.message));
  }, []);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("caregiver");
  const [recovery, setRecovery] = useState(""),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState<{
      user: User;
      key: Uint8Array<ArrayBuffer>;
    } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const result = await api("/auth/forgot", "POST", { email });
        setMessage(result.message);
      } else if (mode === "reset") {
        const info = await api("/auth/recovery-info", "POST", {
          token: resetToken,
        });
        const key = from64(
          await unseal<string>(from64(recovery.trim()), info.recovery_envelope),
        );
        await api("/auth/reset", "POST", {
          token: resetToken,
          credential: await authCredential(info.email, password),
          vault: await wrapVault(password, key),
        });
        history.replaceState(null, "", location.pathname);
        setMode("login");
        setPassword("");
        setMessage("Password changed. Sign in with your new password.");
      } else if (mode === "google-unlock") {
        onLogin(
          googleContext.user,
          await unlockVault(password, googleContext.vault),
        );
        setPassword("");
      } else if (mode === "register" || mode === "google-setup") {
        const key = newKey(),
          recoveryKey = newKey();
        const result = await api(
          mode === "google-setup" ? "/auth/google/complete" : "/auth/register",
          "POST",
          {
            email,
            role,
            credential: await authCredential(email, password),
            vault: await wrapVault(password, key),
            recovery: await seal(recoveryKey, to64(key)),
          },
        );
        setRecovery(to64(recoveryKey));
        setPending({ user: result.user, key });
        setMode("recovery");
      } else {
        const result = await api("/auth/login", "POST", {
          email,
          credential: await authCredential(email, password),
        });
        onLogin(result.user, await unlockVault(password, result.vault));
        setPassword("");
      }
    } catch (err) {
      setError(
        mode === "reset"
          ? "Check your recovery key and link. They must match this account."
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">{uiText("YOUR CIRCLE OF CARE")}</span>
          <h1>
            {uiText("Familiar moments.")}
            <br />
            {uiText("A gentler day.")}
          </h1>
          <p>
            {uiText(
              "A private space for your routines, the people you love, and the memories you choose to keep.",
            )}
          </p>
          <div className="story-line">
            <Heart />
            {uiText("Made around you, filled by you.")}
          </div>
        </div>
        <footer>
          <ShieldCheck size={18} />
          {uiText("Your care information is encrypted on your device.")}
        </footer>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <LanguagePicker />
          <span className="round-icon">
            <LockKeyhole />
          </span>
          <h2>
            {mode === "register"
              ? uiText("Create your private space")
              : mode === "forgot"
                ? uiText("Recover your account")
                : mode === "reset"
                  ? uiText("Set a new password")
                  : mode === "recovery"
                    ? uiText("Keep your recovery key safe")
                    : uiText("Welcome back")}
          </h2>
          <p className="muted">
            {mode === "register"
              ? uiText(
                  "Start with your account. We’ll help you set up a care profile next.",
                )
              : mode === "recovery"
                ? uiText(
                    "Only you have this key. You will need it if you forget your password. We cannot recover your encrypted memories for you.",
                  )
                : mode === "reset"
                  ? uiText(
                      "Your recovery key unlocks your existing encrypted information.",
                    )
                  : uiText("Sign in to unlock your care information.")}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {mode === "recovery" ? (
            <>
              <div className="recovery-key">
                <KeyRound />
                <code>{recovery}</code>
              </div>
              <button
                className="secondary wide"
                onClick={() => {
                  const a = document.createElement("a");
                  const url = URL.createObjectURL(
                    new Blob(
                      [
                        `SmritiSaathi recovery key\nAccount: ${email}\n${recovery}\nKeep offline. Never send to support.\n`,
                      ],
                      { type: "text/plain" },
                    ),
                  );
                  a.href = url;
                  a.download = "SmritiSaathi-recovery-key.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {uiText("Download recovery key")}
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                {uiText("I have saved this key somewhere safe.")}
              </label>
              <button
                className="primary wide"
                disabled={!saved}
                onClick={() => pending && onLogin(pending.user, pending.key)}
              >
                {uiText("Continue")}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              {mode !== "reset" && (
                <label>
                  {uiText("Email address")}
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    readOnly={mode.startsWith("google-")}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={uiText("you@example.com")}
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  {mode === "reset"
                    ? uiText("New password")
                    : uiText("Password")}
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={8}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={uiText("At least 8 characters")}
                  />
                </label>
              )}
              {mode === "reset" && (
                <label>
                  {uiText("Recovery key")}
                  <input
                    required
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              )}
              {(mode === "register" || mode === "google-setup") && (
                <>
                  <label>
                    {uiText("I’m joining as")}
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="caregiver">
                        {uiText("A family member or caregiver")}
                      </option>
                      <option value="patient">
                        {uiText("Someone using support for myself")}
                      </option>
                    </select>
                  </label>
                  <label className="check">
                    <input type="checkbox" required />
                    {uiText(
                      "I understand that my login email is visible to the service, while my care content is encrypted.",
                    )}
                  </label>
                </>
              )}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? uiText("Please wait…")
                  : mode === "register"
                    ? uiText("Create account")
                    : mode === "forgot"
                      ? uiText("Send recovery email")
                      : mode === "reset"
                        ? uiText("Update password")
                        : uiText("Sign in & unlock")}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {mode === "login" && (
            <button
              className="secondary wide"
              disabled={busy}
              onClick={async () => {
                if (!email) return setError("Enter your email first.");
                setBusy(true);
                setError("");
                try {
                  const r = await loginWithPasskey(email);
                  onLogin(r.user, r.key);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {uiText("Sign in with a passkey")}
            </button>
          )}
          {(mode === "login" || mode === "register") && (
            <>
              <button
                className="secondary wide"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api("/auth/google/start", "POST", {});
                    location.assign(r.url);
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {uiText("Continue with Google")}
              </button>
              {!googleConfigured && (
                <p className="muted small">
                  {uiText(
                    "Google sign-in is awaiting the app owner’s local OAuth configuration.",
                  )}
                </p>
              )}
            </>
          )}
          {mode !== "recovery" && (
            <div className="auth-links">
              <button
                onClick={() => {
                  setError("");
                  setMode(mode === "register" ? "login" : "register");
                }}
              >
                {mode === "register"
                  ? uiText("Already have an account? Sign in")
                  : uiText("New here? Create an account")}
              </button>
              {(mode === "login" || mode === "google-unlock") && (
                <button onClick={() => setMode("forgot")}>
                  {uiText("Forgot password?")}
                </button>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("login")}>
                  {uiText("Back to sign in")}
                </button>
              )}
            </div>
          )}
          <div className="privacy-foot">
            <LockKeyhole size={14} />
            {uiText(
              "Passwords never leave your browser in their original form.",
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
