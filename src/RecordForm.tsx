import { useState, type FormEvent } from "react";
import type { Entry, Fields, Kind } from "./records";

type Props = {
  kind: Kind;
  entry?: Entry;
  onSave: (fields: Fields, id?: string) => Promise<void>;
  onClose: () => void;
};

export default function RecordForm({ kind, entry, onSave, onClose }: Props) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [time, setTime] = useState(entry?.time || "09:00");
  const [photo, setPhoto] = useState(entry?.photo ?? "");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function choosePhoto(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 300_000
    ) {
      setError("Choose a JPG, PNG or WebP photo under 300 KB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    setReading(true);
    reader.onload = () => {
      setPhoto(String(reader.result));
      setReading(false);
    };
    reader.onerror = () => {
      setError("This photo could not be read.");
      setReading(false);
    };
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a name or title.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(
        {
          kind,
          title: title.trim(),
          note: note.trim(),
          photo,
          time: kind === "reminder" ? time : "",
          doneDay: entry?.doneDay ?? "",
        },
        entry?.id,
      );
    } catch {
      setError("Could not save the entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="entry-title">
      <h2 id="entry-title">
        {entry ? "Edit" : "Add a"} {kind}
      </h2>
      <form onSubmit={submit}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <label>
          {kind === "person" ? "Name" : "Title"}
          <input
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {kind === "person" ? "Relationship or note" : "Note"}
          <textarea
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {kind === "reminder" ? (
          <label>
            Time
            <input
              type="time"
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
        ) : (
          <label>
            Photo <small>Optional, up to 300 KB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => choosePhoto(event.target.files?.[0])}
            />
          </label>
        )}
        {photo && (
          <button
            type="button"
            className="text-button"
            onClick={() => setPhoto("")}
          >
            Remove selected photo
          </button>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={saving || reading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
