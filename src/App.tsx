import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  Bell,
  BookHeart,
  ChevronRight,
  Heart,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import Auth, { Brand } from "./Auth";
import RecordForm from "./RecordForm";
import { auth } from "./firebase";
import {
  deleteEntry,
  loadEntries,
  saveEntry,
  setReminderDay,
  type Entry,
  type Fields,
  type Kind,
} from "./records";

const pages = [
  { id: "home", label: "Today", icon: Home },
  { id: "memory", label: "My memories", icon: BookHeart },
  { id: "person", label: "People I know", icon: Users },
  { id: "reminder", label: "My reminders", icon: Bell },
] as const;

type View = (typeof pages)[number]["id"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [starting, setStarting] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => {
      setUser(account);
      setStarting(false);
    });
  }, []);

  if (!auth)
    return (
      <main className="setup">
        <Brand />
        <section className="setup-card">
          <h1>Connect Firebase</h1>
          <p>Add the Firebase web app settings to your local .env file.</p>
        </section>
      </main>
    );
  if (starting)
    return (
      <p className="workspace" role="status">
        Opening your care space…
      </p>
    );
  return user ? <CareSpace key={user.uid} user={user} /> : <Auth />;
}

function CareSpace({ user }: { user: User }) {
  const [view, setView] = useState<View>("home");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editor, setEditor] = useState<{ kind: Kind; entry?: Entry } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    let active = true;
    loadEntries(user.uid)
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch(() => {
        if (active) setError("Could not load your care records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.uid]);

  const today = new Date().toLocaleDateString("en-CA");
  const reminders = entries.filter((item) => item.kind === "reminder");
  const finished = reminders.filter((item) => item.doneDay === today).length;
  const latest = entries.find((item) => item.kind === "memory");
  const shown = entries.filter(
    (item) =>
      item.kind === view &&
      (item.title + " " + item.note)
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const currentPage = pages.find((page) => page.id === view);
  const name = user.email?.split("@")[0] || "My care space";

  function go(next: View) {
    setView(next);
    setMobile(false);
    setEditor(null);
    setSearch("");
    setError("");
    setNotice("");
  }

  async function save(fields: Fields, id?: string) {
    await saveEntry(user.uid, fields, id);
    setEditor(null);
    setNotice("Saved to your care space.");
    try {
      setEntries(await loadEntries(user.uid));
    } catch {
      setError(
        "Saved, but the list could not refresh. Reload the page to view it.",
      );
    }
  }

  async function remove(item: Entry) {
    if (!window.confirm("Remove “" + item.title + "”?")) return;
    try {
      await deleteEntry(user.uid, item.id);
      setEntries((items) => items.filter((entry) => entry.id !== item.id));
      if (editor?.entry?.id === item.id) setEditor(null);
      setNotice("Entry removed.");
    } catch {
      setError("Could not remove the entry.");
    }
  }

  async function markReminder(item: Entry) {
    const day = item.doneDay === today ? "" : today;
    try {
      await setReminderDay(user.uid, item.id, day);
      setEntries((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, doneDay: day } : entry,
        ),
      );
    } catch {
      setError("Could not update the reminder.");
    }
  }

  async function logout() {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch {
      setError("Could not sign out. Try again.");
    }
  }

  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Brand />
        <div className="profile-chip">
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small>Your private care space</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              {label}
              {view === id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <LockKeyhole size={16} />
            Only your account can open your entries.
          </div>
          <button onClick={logout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open menu"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            My care space <ChevronRight size={14} /> {currentPage?.label}
          </span>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={16} /> Private space
            </span>
            <button className="text-button mobile-toggle" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="workspace">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {loading && <p role="status">Loading your entries…</p>}
          {view === "home" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">A little at a time</span>
                  <h1>Today</h1>
                  <p>Your memories, familiar people and daily reminders.</p>
                </div>
              </div>
              <section className="daily-banner">
                <div>
                  <h2>Your daily routine</h2>
                  <p>
                    {finished} of {reminders.length} reminders done today
                  </p>
                </div>
                <button onClick={() => go("reminder")}>
                  Open reminders <ChevronRight size={18} />
                </button>
              </section>
              <div className="quick-grid">
                {pages
                  .filter((page) => page.id !== "home")
                  .map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => go(id)}>
                      <span className="tile-icon">
                        <Icon />
                      </span>
                      <strong>{label}</strong>
                      <ChevronRight size={18} />
                    </button>
                  ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Recent memory</h2>
                  <Heart size={20} />
                </div>
                {latest ? (
                  <div className="featured-memory">
                    {latest.photo && <img src={latest.photo} alt="" />}
                    <div>
                      <strong>{latest.title}</strong>
                      <p>{latest.note}</p>
                    </div>
                  </div>
                ) : (
                  <p className="muted">
                    Add a photograph or note to start your memory collection.
                  </p>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Your care space</span>
                  <h1>{currentPage?.label}</h1>
                  <p>
                    {view === "reminder"
                      ? "Keep track of what you want to do today."
                      : "Save a photograph and a few words you want to remember."}
                  </p>
                </div>
                {!editor && (
                  <button
                    className="primary"
                    onClick={() => setEditor({ kind: view })}
                  >
                    <Plus size={18} />
                    Add a {view}
                  </button>
                )}
              </div>
              {editor && (
                <RecordForm
                  key={editor.entry?.id || editor.kind}
                  kind={editor.kind}
                  entry={editor.entry}
                  onSave={save}
                  onClose={() => setEditor(null)}
                />
              )}
              <label>
                Search entries
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              {!loading && !shown.length && (
                <section className="empty">
                  <Heart />
                  <h2>
                    {search ? "No matching entries" : "Nothing saved yet"}
                  </h2>
                  <p>
                    {search
                      ? "Try another name or word."
                      : "Use the Add button to get started."}
                  </p>
                </section>
              )}
              <div
                className={
                  view === "reminder" && shown.length ? "panel" : "photo-grid"
                }
              >
                {shown.map((item) => (
                  <article
                    key={item.id}
                    className={
                      view === "reminder" ? "routine-row large" : "photo-card"
                    }
                  >
                    {view !== "reminder" &&
                      (item.photo ? (
                        <img src={item.photo} alt="" loading="lazy" />
                      ) : (
                        <div className="photo-placeholder">
                          <Heart />
                        </div>
                      ))}
                    <div>
                      {view === "reminder" && <time>{item.time}</time>}
                      <h2>{item.title}</h2>
                      <p>{item.note}</p>
                      <div className="card-actions">
                        {view === "reminder" && (
                          <button
                            className="secondary"
                            aria-pressed={item.doneDay === today}
                            onClick={() => void markReminder(item)}
                          >
                            {item.doneDay === today
                              ? "Done today"
                              : "Mark done"}
                          </button>
                        )}
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditor({ kind: item.kind, entry: item })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="text-button"
                          onClick={() => void remove(item)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          <nav className="bottom-nav" aria-label="Quick navigation">
            {pages.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => go(id)}
              >
                <Icon size={20} />
                <small>{label}</small>
              </button>
            ))}
          </nav>
          <footer className="app-footer">
            <span>
              <Heart size={14} />
              SmritiSaathi
            </span>
            <span>Everyday care and memory support</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
