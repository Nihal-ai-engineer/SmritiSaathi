import { translate as uiText } from "./i18n";
import { useEffect, useState } from "react";
import { Music, Phone } from "lucide-react";
import { regionalLanguages } from "./regionalLanguages";
import type { Profile, CareRecord } from "./api";
import {
  encryptBytes,
  decryptBytes,
  seal,
  unseal,
  type Cipher,
} from "./crypto";

export const regions = [
  "Assam",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Arunachal Pradesh",
  "Tripura",
  "Sikkim",
];
type Track = {
  id: string;
  profileId: string;
  metadata: Cipher;
  audio: Uint8Array<ArrayBuffer>;
};
async function store(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest,
): Promise<any> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("smriti-cultural-audio", 1);
    r.onupgradeneeded = () => {
      r.result
        .createObjectStore("tracks", { keyPath: "id" })
        .createIndex("profile", "profileId");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", mode),
        r = action(tx.objectStore("tracks"));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function CaregiverCall({ profile }: { profile: Profile }) {
  const [show, setShow] = useState(false);
  const number = (profile.caregiverPhone || "").replace(/[^+0-9]/g, "");
  return (
    <div className="caregiver-call">
      <button className="secondary" onClick={() => setShow(!show)}>
        <Phone size={18} />
        {uiText("Call caregiver", "देखभाल करने वाले को कॉल करें")}
      </button>
      {show && (
        <div className="notice" role="status">
          {number && profile.caregiverName ? (
            <>
              <strong>{profile.caregiverName}</strong>
              <p>{profile.caregiverPhone}</p>
              <a className="primary" href={`tel:${number}`}>
                {uiText("Open phone dialler")}
              </a>
              <p className="small">
                {uiText(
                  "You confirm the call on your device. This app does not place or monitor calls. A computer needs a calling app.",
                )}
              </p>
            </>
          ) : (
            <p>
              {uiText(
                "Add your caregiver’s name and phone number in Care & privacy first. No contact is prefilled.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function CulturalPreferences({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (p: Profile) => Promise<void>;
}) {
  const enabled = true;
  const [region, setRegion] = useState(
      regions.includes(profile.cultureRegion || "")
        ? profile.cultureRegion!
        : "",
    ),
    [language, setLanguage] = useState(
      regionalLanguages[profile.cultureRegion || ""] || "",
    ),
    [name, setName] = useState(profile.caregiverName || ""),
    [phone, setPhone] = useState(profile.caregiverPhone || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="panel settings-panel">
      <h2>{uiText("Northeast region & caregiver")}</h2>
      <p>
        {uiText(
          "Your region determines this project's regional-language default. People from the same state may have different languages and traditions.",
        )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            if (!regions.includes(region) || !language.trim())
              throw new Error(
                "Choose a Northeastern state and enter your cultural language.",
              );
            if (phone && !/^\+?\d{7,15}$/.test(phone.replace(/[ ()-]/g, "")))
              throw new Error(
                "Enter a valid caregiver phone number with 7–15 digits.",
              );
            await onSave({
              ...profile,
              cultureEnabled: enabled,
              cultureRegion: region,
              cultureLanguage: language.trim(),
              caregiverName: name.trim(),
              caregiverPhone: phone.trim(),
            });
            setMessage("Preferences saved securely.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {enabled && (
          <>
            <label>
              {uiText("My Northeastern state")}
              <select
                required
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setLanguage(regionalLanguages[e.target.value] || "");
                }}
              >
                <option value="">{uiText("Choose your region")}</option>
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              {uiText("Regional language for this state")}
              <input
                required
                maxLength={80}
                value={language}
                readOnly
                placeholder={uiText("Select your state first")}
              />
            </label>
            <p className="small muted">
              {uiText(
                "Full interface translation for this language is not installed yet. Your current English/Hindi interface remains until a complete language pack is available. No translation service receives your content.",
              )}
            </p>
          </>
        )}
        <label>
          {uiText("Caregiver name")}
          <input
            maxLength={100}
            required={Boolean(phone)}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {uiText("Caregiver phone")}
          <input
            type="tel"
            maxLength={25}
            pattern="[+0-9 ()-]{7,25}"
            required={Boolean(name)}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <p className="small muted">
          {uiText(
            "Use a number you have permission to store. This is separate from your emergency contact.",
          )}
        </p>
        <button className="primary" disabled={busy}>
          {busy ? uiText("Saving…") : uiText("Save preferences")}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
export default function Culture({
  profile,
  records,
  onSave,
}: {
  profile: Profile;
  records: CareRecord[];
  onSave: (value: unknown) => Promise<void>;
}) {
  const [tracks, setTracks] = useState<
      (Track & { title: string; region: string; mime: string })[]
    >([]),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [audioUrl, setAudioUrl] = useState(""),
    [playing, setPlaying] = useState("");
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [exercise, setExercise] = useState<CareRecord | null>(null),
    [stage, setStage] = useState("learn"),
    [response, setResponse] = useState("");
  async function refresh() {
    const rows: Track[] = await store("readonly", (s) =>
      s.index("profile").getAll(profile.id),
    );
    setTracks(
      await Promise.all(
        rows.map(async (row) => ({
          ...row,
          ...(await unseal(profile.key, row.metadata)),
        })),
      ),
    );
  }
  useEffect(() => {
    void refresh().catch(() => setError("Could not open local music storage."));
  }, [profile.id, profile.key]);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  useEffect(() => {
    setAudioUrl("");
    setPlaying("");
    setExercise(null);
  }, [profile.cultureRegion]);
  if (!regions.includes(profile.cultureRegion || "")) return null;
  const activities = records.filter(
    (r) => r.type === "cultural-exercise" && r.region === profile.cultureRegion,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {profile.cultureRegion} · {profile.cultureLanguage}
          </span>
          <h1>{uiText("My culture", "मेरी संस्कृति")}</h1>
          <p>
            {uiText(
              "Familiar music and activities chosen by you and your care circle.",
            )}
          </p>
        </div>
        <Music size={32} />
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>{uiText("Folk & cultural music")}</h2>
          <p>
            {uiText(
              "Add recordings you own or have permission to use. No generated music, automatic streaming or preset personal playlist.",
            )}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                if (
                  ![
                    "audio/mpeg",
                    "audio/mp3",
                    "audio/wav",
                    "audio/x-wav",
                    "audio/mp4",
                    "audio/x-m4a",
                    "audio/ogg",
                    "audio/webm",
                  ].includes(file.type) ||
                  file.size > 20 * 1024 * 1024
                )
                  throw Error(
                    "Choose an MP3, WAV, M4A, OGG or WebM audio file up to 20 MB.",
                  );
                if (tracks.length >= 20)
                  throw Error(
                    "This care profile can keep up to 20 local tracks. Remove one first.",
                  );
                const data = {
                  id: crypto.randomUUID(),
                  profileId: profile.id,
                  metadata: await seal(profile.key, {
                    title: title.trim(),
                    region: profile.cultureRegion,
                    mime: file.type,
                  }),
                  audio: await encryptBytes(
                    profile.key,
                    new Uint8Array(await file.arrayBuffer()),
                  ),
                };
                await store("readwrite", (s) => s.add(data));
                setTitle("");
                setFile(null);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {uiText("Song / recording title")}
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {uiText("Your recording")}
              <input
                type="file"
                required
                accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,.mp3,.m4a"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {uiText("Add to")}
              {profile.cultureRegion}
            </button>
          </form>
          <p className="small muted">
            {uiText(
              "Encrypted on this browser only. Audio does not sync to other devices. Clearing browser storage removes these copies; keep your original files.",
            )}
          </p>
          {tracks
            .filter((t) => t.region === profile.cultureRegion)
            .map((track) => (
              <div className="team-row" key={track.id}>
                <strong>{track.title}</strong>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      const bytes = await decryptBytes(
                        profile.key,
                        track.audio,
                      );
                      setAudioUrl(
                        URL.createObjectURL(
                          new Blob([bytes], { type: track.mime }),
                        ),
                      );
                      setPlaying(track.title);
                    } catch {
                      setError("This recording could not be opened.");
                    }
                  }}
                >
                  {uiText("Listen")}
                </button>
                <button
                  className="text-button"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Remove this local recording? Your original file is not changed.",
                      )
                    )
                      return;
                    await store("readwrite", (s) => s.delete(track.id));
                    setAudioUrl("");
                    setPlaying("");
                    await refresh();
                  }}
                >
                  {uiText("Remove")}
                </button>
              </div>
            ))}
          {audioUrl && (
            <div>
              <h3>{playing}</h3>
              <audio
                key={audioUrl}
                controls
                src={audioUrl}
                style={{ width: "100%" }}
              />
              <p className="small">
                {uiText(
                  "Choose a comfortable volume. You can pause or stop at any time.",
                )}
              </p>
            </div>
          )}
        </section>
        <section className="panel settings-panel">
          <h2>{uiText("Familiar cultural exercises")}</h2>
          <p>
            {uiText(
              "Create a gentle learn-first, recall-later activity from a familiar song, festival, object or tradition. Use your own words and preferred language.",
            )}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await onSave({
                  type: "cultural-exercise",
                  region: profile.cultureRegion,
                  language: profile.cultureLanguage,
                  question: question.trim(),
                  answer: answer.trim(),
                });
                setQuestion("");
                setAnswer("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {uiText("Question / prompt")}
              <input
                required
                maxLength={200}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <label>
              {uiText("Familiar answer")}
              <textarea
                required
                maxLength={1000}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {uiText("Save activity")}
            </button>
          </form>
          {activities.length === 0 && (
            <p>{uiText("No activities for this region yet. Add one above.")}</p>
          )}
          {activities.map((r) => (
            <button
              className="secondary wide"
              key={r.id}
              onClick={() => {
                setExercise(r);
                setStage("learn");
                setResponse("");
              }}
            >
              {r.question}
            </button>
          ))}
          {exercise && (
            <div className="notice">
              <h3>{exercise.question}</h3>
              {stage === "learn" ? (
                <>
                  <p>{exercise.answer}</p>
                  <button
                    className="primary"
                    onClick={() => setStage("recall")}
                  >
                    {uiText("I’m ready to remember")}
                  </button>
                </>
              ) : (
                <>
                  <label>
                    {uiText("What do you remember?")}
                    <input
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() => setStage("reveal")}
                  >
                    {uiText("Show the answer")}
                  </button>
                  {stage === "reveal" && (
                    <p>
                      {exercise.answer}
                      {uiText(
                        "· Take your time. There is no score or diagnosis.",
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <p className="small muted">
            {uiText(
              "These are optional leisure and recall activities, not treatment or a test for brain damage. You can skip any activity.",
            )}
          </p>
        </section>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
