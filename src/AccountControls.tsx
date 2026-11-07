import { translate as uiText } from "./i18n";
import { useEffect, useState } from "react";
import { api, type User } from "./api";
import { authCredential, wrapVault } from "./crypto";
export default function AccountControls({
  user,
  vault,
  onDeleted,
}: {
  user: User;
  vault: Uint8Array<ArrayBuffer>;
  onDeleted: () => void;
}) {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [keys, setKeys] = useState<any[]>([]);
  const refresh = () => api("/auth/passkeys").then((r) => setKeys(r.items));
  const [google, setGoogle] = useState({ configured: false, linked: false });
  useEffect(() => {
    void refresh().catch(() => {});
    void api("/auth/google/status")
      .then(setGoogle)
      .catch(() => {});
  }, []);
  return (
    <section className="panel settings-panel">
      <h2>{uiText("Account security")}</h2>
      <p>{user.email}</p>
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/auth/password", "POST", {
              current: await authCredential(user.email, current),
              credential: await authCredential(user.email, next),
              vault: await wrapVault(next, vault),
            });
            setCurrent("");
            setNext("");
            setMessage("Password updated. Other devices have been signed out.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {uiText("Current password")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          {uiText("New password")}
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          {uiText("Change password")}
        </button>
      </form>
      <h3>{uiText("Google sign-in")}</h3>
      <p>
        {google.linked
          ? uiText("Google is connected to this account.")
          : uiText(
              "Connect Google after confirming your current password above. Google never receives your care content.",
            )}
      </p>
      <button
        className="secondary"
        disabled={busy || !current}
        onClick={async () => {
          setBusy(true);
          try {
            const credential = await authCredential(user.email, current);
            if (google.linked) {
              await api("/auth/google/disconnect", "POST", { credential });
              setGoogle({ ...google, linked: false });
              setMessage(
                "Google disconnected. Password sign-in remains available.",
              );
            } else {
              const r = await api("/auth/google/start", "POST", {
                link: true,
                credential,
              });
              location.assign(r.url);
            }
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {google.linked ? uiText("Disconnect Google") : uiText("Connect Google")}
      </button>
      {!google.configured && (
        <p className="muted small">
          {uiText(
            "Google OAuth credentials have not been configured locally yet.",
          )}
        </p>
      )}
      <h3>{uiText("Registered passkeys")}</h3>
      <button className="text-button" onClick={() => void refresh()}>
        {uiText("Refresh list")}
      </button>
      {keys.map((k) => (
        <div className="team-row" key={k.id}>
          <span>
            {uiText("Added")}
            {new Date(k.created_at).toLocaleDateString()} ·{" "}
            {k.ready ? uiText("Ready") : uiText("Incomplete")}
          </span>
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              try {
                await api(
                  `/auth/passkeys/${encodeURIComponent(k.id)}`,
                  "DELETE",
                );
                await refresh();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {uiText("Remove")}
          </button>
        </div>
      ))}
      <details>
        <summary>{uiText("Delete my account")}</summary>
        <p>
          {uiText(
            "This deletes all care profiles you own, including their records and photos, for everyone in those care circles. Export anything you need first. Copies already downloaded by others cannot be erased.",
          )}
        </p>
        <label>
          {uiText("Type DELETE")}
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          {uiText("Confirm your password")}
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button
          className="danger"
          disabled={busy || confirmation !== "DELETE" || !current}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/auth/delete-account", "POST", {
                credential: await authCredential(user.email, current),
                confirmation,
              });
              onDeleted();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {uiText("Permanently delete my account")}
        </button>
      </details>
    </section>
  );
}
