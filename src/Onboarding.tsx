import { translate as uiText } from "./i18n";
import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { api, type User } from "./api";
import { newKey, seal, to64 } from "./crypto";
import { Brand } from "./Auth";
export default function Onboarding({
  user,
  vault,
  onDone,
}: {
  user: User;
  vault: Uint8Array<ArrayBuffer>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [info, setInfo] = useState({
    name: "",
    dob: "",
    relationship: user.role === "patient" ? "Myself" : "",
    language: "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    emergencyName: "",
    emergencyPhone: "",
    notes: "",
  });
  const [consent, setConsent] = useState(false);
  const field = (key: keyof typeof info, value: string) =>
    setInfo({ ...info, [key]: value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if (new Date(info.dob) > new Date())
        return setError("Date of birth cannot be in the future.");
      setStep(1);
      return;
    }
    if (!consent) return;
    setBusy(true);
    try {
      const key = newKey();
      await api("/profiles", "POST", {
        payload: await seal(key, info),
        keyEnvelope: await seal(vault, to64(key)),
        consent: "care-consent-v1",
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup">
      <Brand />
      <div className="setup-card">
        <div className="steps">
          <span className={step === 0 ? "active" : ""}>
            {uiText("01 · About you")}
          </span>
          <span className={step === 1 ? "active" : ""}>
            {uiText("02 · Care & privacy")}
          </span>
        </div>
        <h1>
          {step === 0
            ? uiText("Let’s make this yours.")
            : uiText("A safe circle starts here.")}
        </h1>
        <p className="muted">
          {step === 0
            ? uiText(
                "Tell us who this care space is for. Your details are encrypted before saving.",
              )
            : uiText(
                "Add an emergency contact and choose what you’re comfortable sharing.",
              )}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          {step === 0 ? (
            <>
              <label>
                {uiText("Full name of the person receiving care")}
                <input
                  required
                  autoComplete="name"
                  maxLength={100}
                  value={info.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  {uiText("Date of birth")}
                  <input
                    required
                    type="date"
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={info.dob}
                    onChange={(e) => field("dob", e.target.value)}
                  />
                </label>
                <label>
                  {uiText("Your relationship")}
                  <input
                    required
                    maxLength={80}
                    value={info.relationship}
                    onChange={(e) => field("relationship", e.target.value)}
                    placeholder={uiText("Your relationship to this person")}
                  />
                </label>
              </div>
              <label>
                {uiText("Preferred language")}
                <select
                  value={info.language}
                  onChange={(e) => field("language", e.target.value)}
                >
                  <option value="en">{uiText("English")}</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </label>
              <label>
                {uiText("Time zone")}
                <select
                  value={info.timezone}
                  onChange={(e) => field("timezone", e.target.value)}
                >
                  {Array.from(
                    new Set([
                      info.timezone,
                      ...Intl.supportedValuesOf("timeZone"),
                    ]),
                  ).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                {uiText("Emergency contact name")}
                <input
                  required
                  maxLength={100}
                  value={info.emergencyName}
                  onChange={(e) => field("emergencyName", e.target.value)}
                />
              </label>
              <label>
                {uiText("Emergency contact phone")}
                <input
                  type="tel"
                  required
                  pattern="[+0-9 ()-]{7,25}"
                  maxLength={25}
                  value={info.emergencyPhone}
                  onChange={(e) => field("emergencyPhone", e.target.value)}
                />
              </label>
              <label>
                {uiText("Anything that helps us support you?")}{" "}
                <span className="muted">{uiText("Optional")}</span>
                <textarea
                  maxLength={1500}
                  value={info.notes}
                  onChange={(e) => field("notes", e.target.value)}
                  placeholder={uiText(
                    "Preferred routines, things that help you feel comfortable…",
                  )}
                />
              </label>
              <div className="notice">
                <ShieldCheck size={20} />
                <span>
                  {uiText(
                    "Your name, contact details, photos and memories are encrypted. The service can see your login email and basic usage metadata. Only people you deliberately invite get access to this care space.",
                  )}
                </span>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                {uiText(
                  "I am entering my own information, or I have permission to manage this person’s care information and contact details.",
                )}
              </label>
              <p className="muted small">
                {uiText(
                  "SmritiSaathi supports routines and practice. It does not diagnose conditions or replace professional care.",
                )}
              </p>
            </>
          )}
          <div className="form-actions">
            {step === 1 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(0)}
              >
                {uiText("Back")}
              </button>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? uiText("Saving securely…")
                : step === 0
                  ? uiText("Continue")
                  : uiText("Open my care space")}
              {step === 0 ? <ArrowRight size={18} /> : <Check size={18} />}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
