import { translate as uiText } from "./i18n";
import { useState } from "react";
import Photo from "./Photo";
import { api, type Profile, type CareRecord } from "./api";
import { seal } from "./crypto";
export default function RecordDetails({
  record,
  kind,
  profile,
  onSaved,
}: {
  record: CareRecord;
  kind: string;
  profile: Profile;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(record.title || record.name || ""),
    [caption, setCaption] = useState(record.caption || ""),
    [relationship, setRelationship] = useState(record.relationship || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const { id, version, created_at, photo_id, ...content } = record;
          await api(`/profiles/${profile.id}/records/${id}`, "PUT", {
            version,
            payload: await seal(profile.key, {
              ...content,
              ...(kind === "person"
                ? { name: title.trim(), relationship: relationship.trim() }
                : { title: title.trim() }),
              caption: caption.trim(),
            }),
          });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Photo
        id={record.photo_id}
        profileId={profile.id}
        vaultKey={profile.key}
        alt={title}
      />
      <label>
        {kind === "person" ? uiText("Name") : uiText("Title")}
        <input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {kind === "person" && (
        <label>
          {uiText("Relationship")}
          <input
            required
            maxLength={80}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
        </label>
      )}
      <label>
        {uiText("Caption")}
        <textarea
          required
          maxLength={2000}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? uiText("Saving…") : uiText("Save changes")}
      </button>
    </form>
  );
}
