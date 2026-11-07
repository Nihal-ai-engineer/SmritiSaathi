import { translate as uiText } from "./i18n";
import { useLanguage, setLanguage, languageOptions } from "./i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Heart,
  Home,
  Bell,
  BookHeart,
  Users,
  Brain,
  MessageCircle,
  Settings,
  ShieldCheck,
  Plus,
  LogOut,
  LockKeyhole,
  ArrowRight,
  Check,
  X,
  Trash2,
  Volume2,
  Phone,
  Activity,
  Menu,
  Download,
  RefreshCw,
  Mail,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import AccountControls from "./AccountControls";
import AccountDashboard from "./AccountDashboard";
import RecordDetails from "./RecordDetails";
import Help from "./Help";
import ConnectionStatus from "./ConnectionStatus";
import Auth, { Brand } from "./Auth";
import {
  rememberDevice,
  restoreDevice,
  forgetDevice,
  touchDevice,
} from "./device";
import { addPasskey } from "./passkeys";
import Onboarding from "./Onboarding";
import Games from "./Games";
import LocalAssistant from "./LocalAssistant";
import Culture, {
  CulturalPreferences,
  CaregiverCall,
  regions,
} from "./Culture";
import Photo, { uploadPhoto } from "./Photo";
import { api, type User, type Profile, type CareRecord } from "./api";
import { seal, unseal, to64, from64 } from "./crypto";

const navigation = [
  { id: "account", label: "My account", hi: "मेरा खाता", icon: Settings },
  { id: "home", label: "Today", hi: "आज", icon: Home },
  { id: "reminder", label: "My reminders", hi: "मेरे रिमाइंडर", icon: Bell },
  { id: "memory", label: "My memories", hi: "मेरी यादें", icon: BookHeart },
  { id: "person", label: "People I know", hi: "मेरे अपने", icon: Users },
  { id: "games", label: "Brain games", hi: "दिमागी खेल", icon: Brain },
  {
    id: "cognitive",
    label: "Cognitive practice",
    hi: "संज्ञानात्मक अभ्यास",
    icon: Activity,
  },
  { id: "health", label: "Daily wellbeing", hi: "रोज़ की देखभाल", icon: Heart },
  { id: "culture", label: "My culture", hi: "मेरी संस्कृति", icon: Heart },
  {
    id: "assistant",
    label: "Ask Saathi",
    hi: "साथी से पूछें",
    icon: MessageCircle,
  },
  {
    id: "settings",
    label: "Care & privacy",
    hi: "देखभाल और गोपनीयता",
    icon: Settings,
  },
];
const recordKinds = ["memory", "person", "reminder", "practice", "health"];
const emptyRecords: Record<string, CareRecord[]> = {
  memory: [],
  person: [],
  reminder: [],
  practice: [],
  health: [],
};
const habits = [
  [
    "routine",
    "Keep a familiar routine",
    "Follow the daily plan agreed with your care team.",
  ],
  [
    "movement",
    "Make time for gentle movement",
    "Choose an activity that your clinician says is suitable for you.",
  ],
  [
    "connection",
    "Connect with someone",
    "A familiar conversation, a shared meal or a call.",
  ],
  ["rest", "Make space for rest", "Take a break when you feel tired."],
];
function localDay(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function speak(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = lang === "hi" ? "hi-IN" : "en-IN";
  voice.rate = 0.85;
  const local = window.speechSynthesis
    .getVoices()
    .find((v) => v.localService && v.lang.startsWith(lang));
  if (local) voice.voice = local;
  else return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(voice);
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={uiText("Close")}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Heart;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [vault, setVault] = useState<Uint8Array<ArrayBuffer> | null>(null),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [selected, setSelected] = useState("");
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("home"),
    [mobile, setMobile] = useState(false);
  const [records, setRecords] =
      useState<Record<string, CareRecord[]>>(emptyRecords),
    [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [adding, setAdding] = useState<string | null>(null),
    [deleting, setDeleting] = useState<{
      kind: string;
      record: CareRecord;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [team, setTeam] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [inviteEmail, setInviteEmail] = useState(""),
    [inviteLink, setInviteLink] = useState("");
  const [form, setForm] = useState({
      title: "",
      caption: "",
      relationship: "",
      time: "09:00",
    }),
    [photo, setPhoto] = useState<File | null>(null);
  const [profileEdit, setProfileEdit] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<{
    kind: string;
    record: CareRecord;
  } | null>(null);
  const hashParams = useRef(new URLSearchParams(location.hash.slice(1))),
    verifiedOnce = useRef(false);
  const profile = profiles.find((p) => p.id === selected) || profiles[0];
  const effectiveLanguage = useLanguage();
  const hi = effectiveLanguage === "hi";
  const t = uiText;
  const today = profile ? localDay(profile.timezone) : "";
  const reminders = [...records.reminder].sort((a, b) =>
    (a.time || "").localeCompare(b.time || ""),
  );
  const completed = reminders.filter((r) =>
    (r.doneDays || []).includes(today),
  ).length;
  const practice = records.practice;

  useEffect(() => {
    const value = hashParams.current.get("verify");
    if (value && !verifiedOnce.current) {
      verifiedOnce.current = true;
      history.replaceState(null, "", location.pathname);
      void api("/auth/verify", "POST", { token: value })
        .then(() =>
          setNotice("Email verified. Sign in to open your care space."),
        )
        .catch((e) => setError(e.message));
    }
  }, []);
  useEffect(() => {
    let stopped = false;
    if (hashParams.current.has("reset")) {
      setStarting(false);
      return;
    }
    void api("/auth/me")
      .then(async (r) => {
        if (!r.user) {
          await forgetDevice();
          return;
        }
        const key = await restoreDevice(r.user.id);
        if (key && !stopped) await login(r.user, key);
      })
      .catch(() => {})
      .finally(() => {
        if (!stopped) setStarting(false);
      });
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    if (!vault) return;
    let last = Date.now();
    const expire = () => {
      setVault(null);
      setUser(null);
      setProfiles([]);
      setRecords(emptyRecords);
      void forgetDevice();
    };
    const idleCheck = setInterval(() => {
      if (Date.now() - last >= 5 * 86400000) expire();
    }, 60000);
    const touch = () => {
      if (document.hidden || Date.now() - last < 60000) return;
      last = Date.now();
      void api("/auth/activity", "POST")
        .then(touchDevice)
        .catch((failure) => {
          if (failure.status !== 401) {
            setNotice(
              "The local server is unavailable. Your loaded activities still work; reconnect before saving.",
            );
            return;
          }
          setVault(null);
          setUser(null);
          setProfiles([]);
          setRecords(emptyRecords);
          void forgetDevice();
        });
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    window.addEventListener("focus", touch);
    return () => {
      clearInterval(idleCheck);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("focus", touch);
    };
  }, [vault]);
  useEffect(() => {
    document.documentElement.lang = effectiveLanguage;
  }, [effectiveLanguage]);
  async function loadProfiles(accountKey = vault) {
    if (!accountKey) return;
    setLoading(true);
    setError("");
    try {
      const result = await api("/profiles");
      const items: Profile[] = await Promise.all(
        result.items.map(async (p: any) => {
          const key = from64(await unseal<string>(accountKey, p.key_envelope));
          return {
            ...(await unseal(key, p.payload)),
            id: p.id,
            role: p.role,
            key,
          };
        }),
      );
      setProfiles(items);
      setSelected((current) =>
        items.some((p) => p.id === current) ? current : items[0]?.id || "",
      );
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function login(account: User, key: Uint8Array<ArrayBuffer>) {
    try {
      await rememberDevice(account.id, key);
    } catch {
      setNotice(
        "This browser cannot remember your private space. Sign in again after closing it.",
      );
    }
    setUser(account);
    setVault(key);
    setLoaded(false);
    setNotice("");
    if (account.email_verified) await loadProfiles(key);
  }
  async function refreshVerification() {
    try {
      const result = await api("/auth/me");
      if (!result.user) throw new Error("Please sign in again.");
      setUser(result.user);
      if (result.user.email_verified) await loadProfiles();
      else setNotice("Open the verification email first.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function fetchKind(kind: string, append = false) {
    if (!profile) return;
    const result = await api(
      `/profiles/${profile.id}/records?kind=${kind}${append && cursors[kind] ? `&cursor=${cursors[kind]}` : ""}`,
    );
    const items = await Promise.all(
      result.items.map(async (r: any) => ({
        ...(await unseal(profile.key, r.payload)),
        id: r.id,
        photo_id: r.photo_id,
        version: r.version,
        created_at: r.created_at,
      })),
    );
    setRecords((current) => ({
      ...current,
      [kind]: append ? [...current[kind], ...items] : items,
    }));
    setCursors((current) => ({ ...current, [kind]: result.nextCursor }));
  }
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setRecords(emptyRecords);
    setLoading(true);
    setError("");
    const id = profile.id,
      key = profile.key;
    void Promise.all(
      recordKinds.map(async (kind) => {
        const result = await api(`/profiles/${id}/records?kind=${kind}`);
        return {
          kind,
          nextCursor: result.nextCursor,
          items: await Promise.all(
            result.items.map(async (r: any) => ({
              ...(await unseal(key, r.payload)),
              id: r.id,
              photo_id: r.photo_id,
              version: r.version,
              created_at: r.created_at,
            })),
          ),
        };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const next = { ...emptyRecords };
        const more: Record<string, string | null> = {};
        for (const r of results) {
          next[r.kind] = r.items;
          more[r.kind] = r.nextCursor;
        }
        setRecords(next);
        setCursors(more);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.key]);
  useEffect(() => {
    if (view !== "settings" || !profile) return;
    void api(`/profiles/${profile.id}/team`)
      .then((r) => setTeam(r.items))
      .catch((e) => setError(e.message));
    if (profile.role === "owner")
      void api(`/profiles/${profile.id}/audit`)
        .then((r) => setAudit(r.items))
        .catch((e) => setError(e.message));
  }, [view, profile?.id]);
  async function logout() {
    await forgetDevice();
    try {
      await api("/auth/logout", "POST");
    } finally {
      window.speechSynthesis?.cancel();
      setUser(null);
      setVault(null);
      setProfiles([]);
      setRecords(emptyRecords);
      setLoaded(false);
      setInviteLink("");
      setTeam([]);
      setView("home");
    }
  }
  function openAdd(kind: string) {
    setForm({ title: "", caption: "", relationship: "", time: "09:00" });
    setPhoto(null);
    setFormError("");
    setAdding(kind);
  }
  async function saveRecord(kind: string, value: any, photoId?: string) {
    if (!profile) throw new Error("Choose a care profile.");
    await api(`/profiles/${profile.id}/records`, "POST", {
      kind,
      payload: await seal(profile.key, value),
      photoId,
    });
    await fetchKind(kind);
  }
  async function submitRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!adding || !profile) return;
    setBusy(true);
    setFormError("");
    try {
      if (adding === "memory" && !photo)
        throw new Error("Please choose your photo.");
      if (!form.title.trim()) throw new Error("Please enter a name or title.");
      const photoId = photo
        ? await uploadPhoto(photo, profile.id, profile.key)
        : undefined;
      await saveRecord(
        adding,
        adding === "reminder"
          ? {
              title: form.title.trim(),
              detail: form.caption.trim(),
              time: form.time,
              doneDays: [],
            }
          : adding === "person"
            ? {
                name: form.title.trim(),
                relationship: form.relationship.trim(),
                caption: form.caption.trim(),
              }
            : { title: form.title.trim(), caption: form.caption.trim() },
        photoId,
      );
      setAdding(null);
      setNotice("Saved to your encrypted care space.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleReminder(item: CareRecord) {
    if (!profile) return;
    setError("");
    try {
      const doneDays = (item.doneDays || []).includes(today)
        ? item.doneDays.filter((d: string) => d !== today)
        : [...(item.doneDays || []).slice(-30), today];
      await api(`/profiles/${profile.id}/records/${item.id}`, "PUT", {
        version: item.version,
        payload: await seal(profile.key, {
          title: item.title,
          detail: item.detail,
          time: item.time,
          doneDays,
        }),
      });
      await fetchKind("reminder");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!deleting || !profile) return;
    setBusy(true);
    try {
      await api(
        `/profiles/${profile.id}/records/${deleting.record.id}`,
        "DELETE",
      );
      await fetchKind(deleting.kind);
      setDeleting(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/profiles/${profile.id}/invite`, "POST", {
        email: inviteEmail,
      });
      setInviteLink(
        `${location.origin}/#invite=${result.token}&key=${encodeURIComponent(to64(profile.key))}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function acceptInvite() {
    if (!vault) return;
    setBusy(true);
    setError("");
    try {
      const value = hashParams.current.get("key");
      if (!value)
        throw new Error("This invitation is missing its private key.");
      const key = from64(value);
      if (key.length !== 32) throw new Error("Invalid invitation key.");
      await api("/invitations/accept", "POST", {
        token: hashParams.current.get("invite"),
        keyEnvelope: await seal(vault, to64(key)),
      });
      hashParams.current.delete("invite");
      hashParams.current.delete("key");
      history.replaceState(null, "", location.pathname);
      await loadProfiles();
      setNotice("You have joined the care circle.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    if (!profile) return;
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        profile: { ...profile, key: undefined },
      };
      for (const kind of recordKinds) {
        let cursor: string | null = null;
        const items: any[] = [];
        do {
          const page: { items: any[]; nextCursor: string | null } = await api(
            `/profiles/${profile.id}/records?kind=${kind}&limit=100${cursor ? "&cursor=" + cursor : ""}`,
          );
          for (const row of page.items)
            items.push({
              ...(await unseal(profile.key, row.payload)),
              id: row.id,
              photoId: row.photo_id,
            });
          cursor = page.nextCursor;
        } while (cursor);
        data[kind] = items;
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "SmritiSaathi-private-records.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice(
        "Readable export saved to your device. Store it privately. Photos remain encrypted in the app.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (starting)
    return (
      <main className="setup">
        <Brand />
        <p>{uiText("Opening your private space…")}</p>
      </main>
    );
  if (!user || !vault)
    return (
      <>
        {notice && (
          <div className="global-notice" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="global-error" role="alert">
            {error}
          </div>
        )}
        <Auth
          onLogin={login}
          resetToken={hashParams.current.get("reset") || undefined}
        />
      </>
    );
  if (!user.email_verified)
    return (
      <main className="setup">
        <Brand />
        <section className="setup-card">
          <Mail size={36} />
          <h1>{uiText("Check your inbox")}</h1>
          <p>
            {uiText("We sent a verification link to")}
            <strong>{user.email}</strong>
            {uiText(". Verify your email before setting up your care space.")}
          </p>
          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary" onClick={refreshVerification}>
              {uiText("I’ve verified my email")}
            </button>
            <button
              className="secondary"
              onClick={() =>
                void api("/auth/resend", "POST")
                  .then(() => setNotice("A new link has been sent."))
                  .catch((e) => setError(e.message))
              }
            >
              {uiText("Resend email")}
            </button>
            <button className="text-button" onClick={logout}>
              {uiText("Sign out")}
            </button>
          </div>
          {import.meta.env.DEV && (
            <p className="muted small">
              {uiText("Local development: emails arrive in")}{" "}
              <a href="http://localhost:58025" target="_blank" rel="noreferrer">
                {uiText("your local test inbox")}
              </a>
              {uiText(". No external email is sent.")}
            </p>
          )}
        </section>
      </main>
    );
  if (!loaded)
    return (
      <main className="setup">
        <Brand />
        <div className="setup-card">
          <h2>
            {loading
              ? uiText("Unlocking your space…")
              : uiText("Could not load your care space")}
          </h2>
          {error && <p className="error">{error}</p>}
          <button className="secondary" onClick={() => loadProfiles()}>
            {uiText("Try again")}
          </button>
        </div>
      </main>
    );
  if (hashParams.current.has("invite"))
    return (
      <main className="setup">
        <Brand />
        <section className="setup-card">
          <Users size={36} />
          <h1>{uiText("Join a private care circle")}</h1>
          <p>
            {uiText(
              "Accept only if this invitation was shared directly with you by someone you trust. It grants access to their encrypted care information.",
            )}
          </p>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy} onClick={acceptInvite}>
            {uiText("Accept invitation")}
          </button>
          <button
            className="text-button"
            onClick={() => {
              hashParams.current.delete("invite");
              hashParams.current.delete("key");
              history.replaceState(null, "", location.pathname);
              setNotice("Invitation dismissed.");
            }}
          >
            {uiText("Dismiss")}
          </button>
        </section>
      </main>
    );
  if (!profile)
    return (
      <Onboarding
        user={user}
        vault={vault}
        onDone={() => void loadProfiles()}
      />
    );
  if (
    !regions.includes(profile.cultureRegion || "") ||
    !profile.cultureLanguage?.trim()
  )
    return (
      <main className="setup">
        <Brand />
        <h1>{uiText("Your Northeast care space")}</h1>
        {profile.role === "owner" ? (
          <CulturalPreferences
            profile={profile}
            onSave={async (p) => {
              const { key, id, role, ...value } = p;
              await api(`/profiles/${id}`, "PUT", {
                payload: await seal(key, value),
              });
              await loadProfiles();
            }}
          />
        ) : (
          <section className="setup-card">
            <p>
              {uiText(
                "The care profile owner needs to select a Northeastern state and cultural language before this space can open.",
              )}
            </p>
            <button className="secondary" onClick={() => loadProfiles()}>
              {uiText("Check again")}
            </button>
          </section>
        )}
        <button className="text-button" onClick={logout}>
          {uiText("Sign out")}
        </button>
      </main>
    );
  const go = (next: string) => {
    setView(next);
    setMobile(false);
    setNotice("");
    setError("");
  };
  const addButton = (kind: string, label: string) => (
    <button className="primary" onClick={() => openAdd(kind)}>
      <Plus size={18} />
      {label}
    </button>
  );
  return (
    <div className="app-shell">
      <ConnectionStatus />
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <div className="profile-chip">
          <span className="avatar">{profile.name.slice(0, 1)}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>{t("Your private care space", "आपकी निजी देखभाल")}</small>
          </div>
        </div>
        <nav aria-label={uiText("Main navigation")}>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={20} />
              {uiText(n.label, n.hi)}
              {view === n.id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <LockKeyhole size={16} />
            <span>
              {t(
                "Encrypted. Yours to share.",
                "सुरक्षित। साझा करना आपकी मर्ज़ी।",
              )}
            </span>
          </div>
          <button onClick={logout}>
            <LogOut size={18} />
            {t("Lock & sign out", "लॉक करके बाहर जाएँ")}
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label={uiText("Open menu")}
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            {t("My care space", "मेरी देखभाल")} <ChevronRight size={14} />{" "}
            {uiText(navigation.find((n) => n.id === view)?.label || "")}
          </span>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={16} />
              {t("Private space", "निजी स्थान")}
            </span>
            <button
              type="button"
              className="avatar small-avatar account-trigger"
              aria-label={t(
                "Open my account and language settings",
                "खाता और भाषा सेटिंग खोलें",
              )}
              aria-current={view === "account" ? "page" : undefined}
              onClick={() => go("account")}
              title={user.email}
            >
              {user.email.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="workspace">
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                {uiText("Dismiss")}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button className="text-button" onClick={() => setNotice("")}>
                {uiText("Dismiss")}
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-line" role="status">
              {t("Unlocking your information…", "आपकी जानकारी खुल रही है…")}
            </div>
          )}
          {view === "home" && (
            <>
              <CaregiverCall profile={profile} />
              {profile.cultureRegion && (
                <button className="secondary" onClick={() => go("culture")}>
                  {t("My culture", "मेरी संस्कृति")} · {profile.cultureRegion}
                </button>
              )}
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {new Intl.DateTimeFormat(effectiveLanguage + "-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: profile.timezone,
                    }).format(new Date())}
                  </span>
                  <h1>
                    {t("Hello", "नमस्ते")}, {profile.name.split(" ")[0]}.
                  </h1>
                  <p>
                    {t(
                      "A little structure. A few familiar moments. Your day, at your pace.",
                      "दिन की सरल योजना और कुछ अपनी यादें। अपने समय पर चलें।",
                    )}
                  </p>
                </div>
                <button className="secondary" onClick={() => go("games")}>
                  <Brain size={18} />
                  {t("Start a little practice", "अभ्यास शुरू करें")}
                </button>
              </div>
              <section className="daily-banner">
                <div>
                  <span className="eyebrow">
                    {t("ONE THING AT A TIME", "एक समय पर एक काम")}
                  </span>
                  <h2>
                    {reminders.find((r) => !r.doneDays?.includes(today))
                      ?.title ||
                      t(
                        "Make room for a gentle day.",
                        "अपने दिन को आराम से बिताएँ।",
                      )}
                  </h2>
                  <p>
                    {reminders.length
                      ? t(
                          `${completed} of ${reminders.length} daily reminders completed`,
                          `${reminders.length} में से ${completed} रिमाइंडर पूरे`,
                        )
                      : t(
                          "Add a reminder to build a routine that feels familiar.",
                          "अपनी दिनचर्या के लिए एक रिमाइंडर जोड़ें।",
                        )}
                  </p>
                  <button
                    onClick={() =>
                      reminders.length ? go("reminder") : openAdd("reminder")
                    }
                  >
                    {t(
                      reminders.length ? "See my day" : "Add my first reminder",
                      reminders.length ? "आज की योजना" : "पहला रिमाइंडर जोड़ें",
                    )}
                    <ArrowRight size={18} />
                  </button>
                </div>
                <div className="daily-progress">
                  <span>
                    {reminders.length
                      ? Math.round((completed / reminders.length) * 100)
                      : 0}
                    <small>%</small>
                  </span>
                  <p>{t("of today’s plan", "आज की योजना")}</p>
                </div>
              </section>
              <div className="quick-grid">
                {[
                  {
                    view: "memory",
                    icon: BookHeart,
                    title: t("My memories", "मेरी यादें"),
                    sub: t("Moments that feel like home", "आपके अपने पल"),
                  },
                  {
                    view: "person",
                    icon: Users,
                    title: t("People I know", "मेरे अपने"),
                    sub: t("Your familiar faces", "आपके परिचित चेहरे"),
                  },
                  {
                    view: "cognitive",
                    icon: Brain,
                    title: t("Gentle practice", "आसान अभ्यास"),
                    sub: t(
                      "Learn first, remember later",
                      "पहले सीखें, बाद में याद करें",
                    ),
                  },
                  {
                    view: "assistant",
                    icon: MessageCircle,
                    title: t("Ask Saathi", "साथी से पूछें"),
                    sub: t(
                      "A conversation on your device",
                      "आपके डिवाइस पर बातचीत",
                    ),
                  },
                ].map((q) => (
                  <button key={q.view} onClick={() => go(q.view)}>
                    <span className="tile-icon">
                      <q.icon />
                    </span>
                    <strong>{q.title}</strong>
                    <small>{q.sub}</small>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t("Your reminders", "आपके रिमाइंडर")}</h2>
                    <button
                      className="text-button"
                      onClick={() => go("reminder")}
                    >
                      {t("View all", "सभी देखें")}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {reminders.length ? (
                    reminders.slice(0, 4).map((r) => (
                      <div className="routine-row" key={r.id}>
                        <button
                          className={`check-button ${r.doneDays?.includes(today) ? "checked" : ""}`}
                          aria-label={`Mark ${r.title} ${r.doneDays?.includes(today) ? "incomplete" : "complete"}`}
                          onClick={() => toggleReminder(r)}
                        >
                          {r.doneDays?.includes(today) && <Check size={17} />}
                        </button>
                        <div>
                          <strong>{r.title}</strong>
                          <small>{r.detail}</small>
                        </div>
                        <time>{r.time}</time>
                      </div>
                    ))
                  ) : (
                    <Empty
                      icon={Bell}
                      title={t(
                        "Your day starts with you",
                        "आपसे शुरू होता है आपका दिन",
                      )}
                      description={t(
                        "No reminders yet. Add a routine when you’re ready.",
                        "अभी कोई रिमाइंडर नहीं है। तैयार हों तब जोड़ें।",
                      )}
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t("A moment to remember", "एक अपनी याद")}</h2>
                    <BookHeart size={19} />
                  </div>
                  {records.memory[0] ? (
                    <button
                      className="featured-memory"
                      onClick={() => go("memory")}
                    >
                      <Photo
                        id={records.memory[0].photo_id}
                        profileId={profile.id}
                        vaultKey={profile.key}
                        alt={records.memory[0].title}
                      />
                      <strong>{records.memory[0].title}</strong>
                      <p>{records.memory[0].caption}</p>
                    </button>
                  ) : (
                    <Empty
                      icon={BookHeart}
                      title={t(
                        "Only your real memories",
                        "सिर्फ आपकी असली यादें",
                      )}
                      description={t(
                        "Choose a photo and tell its story. This space starts empty.",
                        "अपनी तस्वीर चुनें और उसकी कहानी लिखें।",
                      )}
                      action={
                        <button
                          className="secondary"
                          onClick={() => openAdd("memory")}
                        >
                          {t("Add a memory", "याद जोड़ें")}
                        </button>
                      }
                    />
                  )}
                </section>
              </div>
              <section className="panel practice-summary">
                <div>
                  <span className="eyebrow">
                    {t("YOUR ACTIVITY", "आपका अभ्यास")}
                  </span>
                  <h2>
                    {practice.length
                      ? `${practice.length} ${t("saved practice sessions", "सहेजे गए अभ्यास")}`
                      : t(
                          "Every small step counts.",
                          "हर छोटा कदम मायने रखता है।",
                        )}
                  </h2>
                  <p>
                    {practice.length
                      ? t(
                          "Based on your recent saved activities. Practice results are not medical assessments.",
                          "आपके सहेजे हुए अभ्यास। ये चिकित्सकीय जाँच नहीं हैं।",
                        )
                      : t(
                          "Your progress appears here after you complete and save an activity.",
                          "अभ्यास पूरा करके सहेजने के बाद यहाँ दिखेगा।",
                        )}
                  </p>
                </div>
                <button className="secondary" onClick={() => go("games")}>
                  {t("Open activities", "अभ्यास खोलें")}
                  <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {(view === "memory" || view === "person") && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {view === "memory"
                      ? t("MOMENTS THAT MATTER", "आपके खास पल")
                      : t("YOUR FAMILIAR FACES", "आपके परिचित चेहरे")}
                  </span>
                  <h1>
                    {view === "memory"
                      ? t("My memories", "मेरी यादें")
                      : t("People I know", "मेरे अपने")}
                  </h1>
                  <p>
                    {t(
                      "Real photos. Your words. Shared only with your care circle.",
                      "असली तस्वीरें और आपके शब्द। केवल आपके देखभाल के साथियों के लिए।",
                    )}
                  </p>
                </div>
                {addButton(
                  view,
                  view === "memory"
                    ? t("Add a memory", "याद जोड़ें")
                    : t("Add a person", "व्यक्ति जोड़ें"),
                )}
              </div>
              <label>
                {uiText("Search loaded photos and captions")}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={uiText("Search privately on this device")}
                />
              </label>
              {search &&
                !records[view].some((r) =>
                  `${r.name || ""} ${r.title || ""} ${r.caption || ""} ${r.relationship || ""}`
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                ) && (
                  <p role="status">
                    {uiText(
                      "No matches in the loaded items. Load more items below to search older records.",
                    )}
                  </p>
                )}
              {records[view].length ? (
                <div className="photo-grid">
                  {records[view]
                    .filter((r) =>
                      `${r.name || ""} ${r.title || ""} ${r.caption || ""} ${r.relationship || ""}`
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
                    )
                    .map((r) => (
                      <article className="photo-card" key={r.id}>
                        <Photo
                          id={r.photo_id}
                          profileId={profile.id}
                          vaultKey={profile.key}
                          alt={r.title || r.name}
                        />
                        <div>
                          <span className="eyebrow">
                            {view === "person"
                              ? r.relationship
                              : t("YOUR MEMORY", "आपकी याद")}
                          </span>
                          <h2>{r.title || r.name}</h2>
                          <p>{r.caption}</p>
                          <div className="card-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                setDetails({ kind: view, record: r })
                              }
                            >
                              {uiText("View / edit")}
                            </button>
                            <button
                              className="text-button"
                              onClick={() => {
                                const voices =
                                  window.speechSynthesis?.getVoices() || [];
                                if (
                                  !voices.some(
                                    (v) =>
                                      v.localService &&
                                      v.lang.startsWith(profile.language),
                                  )
                                )
                                  return setNotice(
                                    "A matching on-device voice is not installed. Read-aloud is disabled to keep your content local.",
                                  );
                                speak(
                                  `${r.title || r.name}. ${r.relationship || ""}. ${r.caption}`,
                                  profile.language,
                                );
                              }}
                            >
                              <Volume2 size={17} />
                              {t("Listen", "सुनें")}
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${r.title || r.name}`}
                              onClick={() => {
                                setFormError("");
                                setDeleting({ kind: view, record: r });
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={view === "memory" ? BookHeart : Users}
                    title={
                      view === "memory"
                        ? t("Your story belongs here", "यहाँ आपकी कहानी होगी")
                        : t(
                            "Start with someone familiar",
                            "किसी अपने से शुरू करें",
                          )
                    }
                    description={t(
                      "Nothing is prefilled. Add your own photo and details to begin.",
                      "कोई जानकारी पहले से भरी नहीं है। अपनी तस्वीर और जानकारी जोड़ें।",
                    )}
                    action={addButton(
                      view,
                      t("Add your first one", "पहला जोड़ें"),
                    )}
                  />
                </section>
              )}
              {cursors[view] && (
                <button
                  className="secondary load-more"
                  onClick={() =>
                    fetchKind(view, true).catch((e) => setError(e.message))
                  }
                >
                  {uiText("Load more")}
                </button>
              )}
            </>
          )}
          {view === "reminder" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {t("YOUR DAILY RHYTHM", "आपकी दिनचर्या")}
                  </span>
                  <h1>
                    {t(
                      "One gentle reminder at a time.",
                      "एक-एक करके काम याद रखें।",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Daily reminders follow your care profile’s time zone.",
                      "रिमाइंडर आपकी प्रोफ़ाइल के समय क्षेत्र के अनुसार हैं।",
                    )}
                  </p>
                </div>
                {addButton("reminder", t("Add reminder", "रिमाइंडर जोड़ें"))}
              </div>
              <p className="footnote">
                {t(
                  "Reminders are shown when you open this app. Background notifications are not enabled.",
                  "ऐप खोलने पर रिमाइंडर दिखते हैं। बैकग्राउंड सूचनाएँ चालू नहीं हैं।",
                )}
              </p>
              <section className="panel">
                {reminders.length ? (
                  reminders.map((r) => (
                    <div className="routine-row large" key={r.id}>
                      <button
                        className={`check-button ${r.doneDays?.includes(today) ? "checked" : ""}`}
                        aria-label={`Mark ${r.title} complete`}
                        onClick={() => toggleReminder(r)}
                      >
                        {r.doneDays?.includes(today) && <Check size={19} />}
                      </button>
                      <time>{r.time}</time>
                      <div>
                        <strong>{r.title}</strong>
                        <small>{r.detail}</small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${r.title}`}
                        onClick={() => {
                          setFormError("");
                          setDeleting({ kind: "reminder", record: r });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={Bell}
                    title={t(
                      "A fresh start for your routine",
                      "अपनी दिनचर्या शुरू करें",
                    )}
                    description={t(
                      "Add only the reminders and instructions chosen by you or your care team.",
                      "आप या आपकी देखभाल टीम के चुने हुए रिमाइंडर जोड़ें।",
                    )}
                  />
                )}
              </section>
              {cursors.reminder && (
                <button
                  className="secondary load-more"
                  onClick={() =>
                    fetchKind("reminder", true).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  {uiText("Load more reminders")}
                </button>
              )}
            </>
          )}
          {(view === "games" || view === "cognitive") && (
            <Games
              key={view + profile.id}
              cognitive={view === "cognitive"}
              profile={profile}
              people={records.person}
              memories={records.memory}
              onSave={(v) => saveRecord("practice", v)}
            />
          )}
          {view === "health" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {uiText("SMALL DAILY MOMENTS")}
                  </span>
                  <h1>
                    {t(
                      "Care for your everyday wellbeing.",
                      "रोज़ की सेहत का ध्यान रखें।",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Follow your clinician’s advice and go at your own pace.",
                      "डॉक्टर की सलाह मानें और अपनी गति से चलें।",
                    )}
                  </p>
                </div>
              </div>
              <div className="wellbeing-grid">
                {habits.map(([id, title, desc]) => {
                  const done = records.health.some(
                    (r) => r.habit === id && r.day === today,
                  );
                  return (
                    <button
                      className={`panel habit ${done ? "done" : ""}`}
                      key={id}
                      onClick={async () => {
                        if (done) return;
                        try {
                          await saveRecord("health", { habit: id, day: today });
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <span className="tile-icon">
                        {done ? <Check /> : <Heart />}
                      </span>
                      <h2>{title}</h2>
                      <p>{desc}</p>
                      <span className="pill">
                        {done
                          ? uiText("Completed today")
                          : uiText("Mark complete")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="footnote">
                {uiText(
                  "These are general wellbeing prompts, not treatment or a promise to prevent brain or cellular damage.",
                )}
              </p>
            </>
          )}
          {view === "assistant" && <LocalAssistant />}
          {view === "culture" && (
            <Culture
              key={profile.id}
              profile={profile}
              records={records.health}
              onSave={(value) => saveRecord("health", value)}
            />
          )}
          {view === "account" && (
            <AccountDashboard
              user={user}
              profile={profile}
              vault={vault}
              language={effectiveLanguage}
              onLanguage={(value) => {
                if (!setLanguage(value)) {
                  setNotice(
                    "Language changed for this visit. Your browser could not save the preference.",
                  );
                }
              }}
              onLogout={() => void logout()}
              onCare={() => go("settings")}
            />
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{uiText("YOU’RE IN CONTROL")}</span>
                  <h1>{t("Care & privacy", "देखभाल और गोपनीयता")}</h1>
                  <p>
                    {uiText(
                      "Your care information is encrypted before it leaves this browser.",
                    )}
                  </p>
                </div>
                <ShieldCheck size={34} />
              </div>
              <div className="settings-grid">
                <section className="panel settings-panel">
                  <h2>{uiText("Care profile")}</h2>
                  <dl>
                    <dt>{uiText("Name")}</dt>
                    <dd>{profile.name}</dd>
                    <dt>{uiText("Date of birth")}</dt>
                    <dd>{profile.dob}</dd>
                    <dt>{uiText("Your relationship")}</dt>
                    <dd>{profile.relationship}</dd>
                    <dt>{uiText("Language")}</dt>
                    <dd>
                      {
                        languageOptions.find(
                          (option) => option.code === effectiveLanguage,
                        )?.name
                      }
                    </dd>
                    <dt>{uiText("Time zone")}</dt>
                    <dd>{profile.timezone}</dd>
                    <dt>{uiText("Emergency contact")}</dt>
                    <dd>
                      {profile.emergencyName}
                      <br />
                      {profile.emergencyPhone}
                    </dd>
                  </dl>
                  {profile.role === "owner" && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setFormError("");
                        setProfileEdit({ ...profile });
                      }}
                    >
                      {uiText("Edit profile")}
                    </button>
                  )}
                  <a
                    className="secondary emergency-call"
                    href={`tel:${profile.emergencyPhone.replace(/[^+0-9]/g, "")}`}
                  >
                    <Phone size={17} />
                    {uiText("Call")}
                    {profile.emergencyName}
                  </a>
                  {profiles.length > 1 && (
                    <label>
                      {uiText("Switch care profile")}
                      <select
                        value={profile.id}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </section>
                <section className="panel settings-panel">
                  <h2>{uiText("Your privacy")}</h2>
                  <p>
                    {uiText(
                      "You stay signed in on this device. After five days without using the app, sign-in is required again. Use Sign out on shared devices.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await addPasskey(user.email, vault);
                        setNotice(
                          "Passkey added. Keep your password and recovery key as backup.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {uiText("Add a passkey")}
                  </button>
                  <div className="privacy-item">
                    <LockKeyhole />
                    <div>
                      <strong>{uiText("Encrypted care content")}</strong>
                      <p>
                        {uiText(
                          "Names, dates of birth, contact details, memories, reminders and photos are encrypted with keys held in your browser while unlocked.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="privacy-item">
                    <ShieldCheck />
                    <div>
                      <strong>
                        {uiText("What the service can still see")}
                      </strong>
                      <p>
                        {uiText(
                          "Login email, account role, verification status, membership links, record counts, sizes and timestamps. There is no support key for decrypting your care content.",
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="muted small">
                    {uiText(
                      "A compromised device or malicious app update could expose unlocked data. This local build needs independent security review before public use.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={exportData}
                  >
                    <Download size={17} />
                    {uiText("Export my readable records")}
                  </button>
                  <p className="muted small">
                    {uiText(
                      "The export contains private plaintext. Photos are not included.",
                    )}
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      api("/auth/logout-all", "POST")
                        .then(logout)
                        .catch((e) => setError(e.message))
                    }
                  >
                    {uiText("Sign out all devices")}
                  </button>
                </section>
                <section className="panel settings-panel">
                  <h2>{uiText("Your care circle")}</h2>
                  <p className="muted">
                    {uiText(
                      "Only explicitly invited accounts can open this care space.",
                    )}
                  </p>
                  {team.map((m) => (
                    <div className="team-row" key={m.id}>
                      <div>
                        <strong>{m.email}</strong>
                        <small>{m.role}</small>
                      </div>
                      {profile.role === "owner" && m.role !== "owner" && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                "Remove future access? This cannot erase data this person already saved.",
                              )
                            )
                              return;
                            try {
                              await api(
                                `/profiles/${profile.id}/team/${m.id}`,
                                "DELETE",
                              );
                              setTeam((current) =>
                                current.filter((x) => x.id !== m.id),
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          {uiText("Remove access")}
                        </button>
                      )}
                    </div>
                  ))}
                  {profile.role === "owner" && (
                    <form onSubmit={invite}>
                      <label>
                        {uiText("Invite caregiver by email")}
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => {
                            setInviteEmail(e.target.value);
                            setInviteLink("");
                          }}
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        {uiText("Create private invitation")}
                      </button>
                    </form>
                  )}
                  {inviteLink && (
                    <div className="notice invitation">
                      <strong>
                        {uiText("Share this link directly with")}
                        {inviteEmail}.
                      </strong>
                      <p>
                        {uiText(
                          "It contains the care key. Do not post it publicly. It expires in 24 hours and only this email can accept.",
                        )}
                      </p>
                      <textarea
                        readOnly
                        aria-label={uiText("Private invitation link")}
                        value={inviteLink}
                      />
                      <button
                        className="secondary"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(inviteLink)
                            .then(() =>
                              setNotice(
                                "Invitation copied. Share it privately.",
                              ),
                            )
                            .catch(() =>
                              setError(
                                "Select and copy the invitation link manually.",
                              ),
                            )
                        }
                      >
                        {uiText("Copy invitation")}
                      </button>
                    </div>
                  )}
                </section>
                <AccountControls
                  user={user}
                  vault={vault}
                  onDeleted={() => void logout()}
                />
                {profile.role === "owner" && (
                  <CulturalPreferences
                    key={profile.id + String(profile.cultureEnabled)}
                    profile={profile}
                    onSave={async (p) => {
                      const { key, id, role, ...value } = p;
                      await api(`/profiles/${id}`, "PUT", {
                        payload: await seal(key, value),
                      });
                      await loadProfiles();
                    }}
                  />
                )}
                <Help />
                <section className="panel settings-panel">
                  <h2>{uiText("Recent account activity")}</h2>
                  <p className="muted">
                    {uiText("Content-free records of access and changes.")}
                  </p>
                  {audit.length ? (
                    audit.slice(0, 12).map((event, i) => (
                      <div className="audit-row" key={i}>
                        <span>{event.action.replace(":", " · ")}</span>
                        <time>
                          {new Date(event.created_at).toLocaleString()}
                        </time>
                      </div>
                    ))
                  ) : (
                    <p>{uiText("No activity available.")}</p>
                  )}
                </section>
              </div>
            </>
          )}
          <nav className="bottom-nav" aria-label={uiText("Quick navigation")}>
            {navigation
              .filter((n) =>
                ["home", "memory", "person", "games", "settings"].includes(
                  n.id,
                ),
              )
              .map((n) => (
                <button
                  key={n.id}
                  className={view === n.id ? "active" : ""}
                  onClick={() => go(n.id)}
                >
                  <n.icon size={20} />
                  <small>{uiText(n.label, n.hi)}</small>
                </button>
              ))}
          </nav>
          <footer className="app-footer">
            <span>
              <Heart size={14} />
              {uiText("SmritiSaathi · Support at your pace.")}
            </span>
            <span>{uiText("Support, not diagnosis.")}</span>
          </footer>
        </main>
      </div>
      {details && (
        <Modal
          title={uiText("Your saved details")}
          onClose={() => setDetails(null)}
        >
          <RecordDetails
            record={details.record}
            kind={details.kind}
            profile={profile}
            onSaved={() => {
              void fetchKind(details.kind);
              setDetails(null);
              setNotice("Changes saved securely.");
            }}
          />
        </Modal>
      )}
      {adding && (
        <Modal
          title={
            adding === "memory"
              ? t("Add a memory", "याद जोड़ें")
              : adding === "person"
                ? t("Add someone familiar", "किसी अपने को जोड़ें")
                : t("Add a reminder", "रिमाइंडर जोड़ें")
          }
          onClose={() => !busy && setAdding(null)}
        >
          <form onSubmit={submitRecord}>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            {adding !== "reminder" && (
              <label className="file-field">
                {t("Your photo", "आपकी तस्वीर")}{" "}
                {adding === "person" && (
                  <span className="muted">{uiText("(optional)")}</span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={adding === "memory"}
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
                <small>
                  {uiText(
                    "JPG, PNG or WebP · up to 10 MB · encrypted before uploading",
                  )}
                </small>
              </label>
            )}
            <label>
              {adding === "person"
                ? t("Full name", "पूरा नाम")
                : t("Title", "शीर्षक")}
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            {adding === "person" && (
              <label>
                {t("Relationship", "रिश्ता")}
                <input
                  required
                  maxLength={80}
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value })
                  }
                />
              </label>
            )}
            {adding === "reminder" && (
              <label>
                {t("Time", "समय")}
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
            )}
            <label>
              {adding === "reminder"
                ? t("Helpful detail", "सहायक जानकारी")
                : t("Caption or memory", "विवरण या याद")}
              <textarea
                required={adding !== "reminder"}
                maxLength={2000}
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
              />
            </label>
            <p className="muted small">
              {uiText(
                "Only upload photos and details you have permission to share with this care circle.",
              )}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setAdding(null)}
              >
                {uiText("Cancel")}
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? uiText("Encrypting & saving…")
                  : t("Save securely", "सुरक्षित सहेजें")}
                <LockKeyhole size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={uiText("Remove this item?")}
          onClose={() => !busy && setDeleting(null)}
        >
          <p>
            “{deleting.record.title || deleting.record.name}
            {uiText(
              "” will be removed from this care space. This cannot be undone.",
            )}
          </p>
          {formError && <p className="error">{formError}</p>}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {uiText("Keep it")}
            </button>
            <button className="danger" disabled={busy} onClick={remove}>
              {uiText("Remove item")}
            </button>
          </div>
        </Modal>
      )}
      {profileEdit && (
        <Modal
          title={uiText("Edit care profile")}
          onClose={() => !busy && setProfileEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setFormError("");
              try {
                const { key, id, role, ...value } = profileEdit;
                await api(`/profiles/${id}`, "PUT", {
                  payload: await seal(key, value),
                });
                await loadProfiles();
                setProfileEdit(null);
              } catch (err) {
                setFormError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {formError && <p className="error">{formError}</p>}
            <label>
              {uiText("Full name")}
              <input
                required
                maxLength={100}
                value={profileEdit.name}
                onChange={(e) =>
                  setProfileEdit({ ...profileEdit, name: e.target.value })
                }
              />
            </label>
            <label>
              {uiText("Date of birth")}
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={profileEdit.dob}
                onChange={(e) =>
                  setProfileEdit({ ...profileEdit, dob: e.target.value })
                }
              />
            </label>
            <label>
              {uiText("Language")}
              <select
                value={profileEdit.language}
                onChange={(e) =>
                  setProfileEdit({
                    ...profileEdit,
                    language: e.target.value as "en" | "hi",
                  })
                }
              >
                <option value="en">{uiText("English")}</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
            <label>
              {uiText("Emergency contact name")}
              <input
                required
                value={profileEdit.emergencyName}
                onChange={(e) =>
                  setProfileEdit({
                    ...profileEdit,
                    emergencyName: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {uiText("Emergency phone")}
              <input
                type="tel"
                required
                pattern="[+0-9 ()-]{7,25}"
                value={profileEdit.emergencyPhone}
                onChange={(e) =>
                  setProfileEdit({
                    ...profileEdit,
                    emergencyPhone: e.target.value,
                  })
                }
              />
            </label>
            <button className="primary" disabled={busy}>
              {uiText("Save changes")}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
