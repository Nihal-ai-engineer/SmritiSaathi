import { useState, type FormEvent } from "react";
import { Heart, LockKeyhole } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebase";

export function Brand() {
  return (
    <div className="brand">
      <span>
        <Heart fill="currentColor" size={24} />
      </span>
      <div>
        SmritiSaathi<small>Your circle of care</small>
      </div>
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage("If the account exists, a reset email has been requested.");
      } else if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch {
      setMessage("Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: string) {
    setMessage("");
    setPassword("");
    setMode(next);
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">Your private care space</p>
          <h1>
            Familiar faces.
            <br />
            Everyday moments.
          </h1>
          <p>Keep photographs, notes and reminders close by.</p>
        </div>
        <footer>Memory and routine support</footer>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <span className="round-icon">
            <LockKeyhole size={24} />
          </span>
          <h2>
            {mode === "register"
              ? "Create an account"
              : mode === "reset"
                ? "Reset password"
                : "Welcome back"}
          </h2>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  required
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            <button className="primary wide" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "register"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset email"
                    : "Sign in"}
            </button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button onClick={() => changeMode("register")}>
                  Create an account
                </button>
                <button onClick={() => changeMode("reset")}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button onClick={() => changeMode("login")}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
