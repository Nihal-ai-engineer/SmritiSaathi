import { translate as uiText } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Brain, RotateCcw, Check, Play } from "lucide-react";
import type { CareRecord, Profile } from "./api";
import Photo from "./Photo";
const symbols = ["🍎", "🌻", "☕", "🦋", "🍋", "🌿"];
function shuffled<T>(items: T[]) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export default function Games({
  profile,
  people,
  memories,
  onSave,
  cognitive = false,
}: {
  profile: Profile;
  people: CareRecord[];
  memories: CareRecord[];
  onSave: (value: any) => Promise<void>;
  cognitive?: boolean;
}) {
  const [mode, setMode] = useState(cognitive ? "recall" : "match"),
    [cards, setCards] = useState(() => shuffled([...symbols, ...symbols]));
  const [opened, setOpened] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]),
    [moves, setMoves] = useState(0),
    [status, setStatus] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState("ready"),
    [sequence, setSequence] = useState<string[]>([]),
    [answer, setAnswer] = useState<string[]>([]),
    [index, setIndex] = useState(0);
  const started = useRef(Date.now());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recall = people.length ? people : memories;
  const item = recall[index % Math.max(recall.length, 1)];
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  function reset(nextMode = mode) {
    if (timeout.current) clearTimeout(timeout.current);
    setMode(nextMode);
    setCards(shuffled([...symbols, ...symbols]));
    setOpened([]);
    setMatched([]);
    setMoves(0);
    setStatus("");
    setSaved(false);
    setPhase("ready");
    setAnswer([]);
    started.current = Date.now();
  }
  async function finish(correct: number, total: number) {
    setSaving(true);
    try {
      await onSave({
        domain: mode,
        correct,
        total,
        duration: Math.round((Date.now() - started.current) / 1000),
        source: "self-reported practice",
      });
      setSaved(true);
      setStatus(
        "Practice saved. Thank you for taking a little time for yourself.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function flip(i: number) {
    if (
      opened.length === 2 ||
      opened.includes(i) ||
      matched.includes(i) ||
      saved
    )
      return;
    const next = [...opened, i];
    setOpened(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      timeout.current = setTimeout(() => {
        if (cards[next[0]] === cards[next[1]])
          setMatched((m) => [...m, ...next]);
        setOpened([]);
      }, 700);
    }
  }
  function startSequence() {
    const next = shuffled(symbols).slice(0, 3);
    setSequence(next);
    setAnswer([]);
    setPhase("learn");
    setSaved(false);
    setStatus("");
    started.current = Date.now();
    timeout.current = setTimeout(() => setPhase("answer"), 3500);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{uiText("A LITTLE PRACTICE")}</span>
          <h1>
            {cognitive
              ? uiText("Learn now, remember later")
              : uiText("Take your time. Enjoy the practice.")}
          </h1>
          <p>
            {uiText(
              "Everything runs on this device. There are no penalties or medical scores.",
            )}
          </p>
        </div>
        <span className="pill">
          <Brain size={16} />
          {uiText("On-device activities")}
        </span>
      </div>
      <div className="tabs">
        {[
          ["match", "Picture pairs"],
          ["sequence", "Remember the order"],
          ["recall", "Familiar memories"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mode === id}
            className={mode === id ? "active" : ""}
            onClick={() => reset(id)}
          >
            {uiText(label)}
          </button>
        ))}
      </div>
      <section className="panel game-panel">
        <div className="panel-heading">
          <h2>
            {mode === "match"
              ? uiText("Find the matching pictures")
              : mode === "sequence"
                ? uiText("Watch first, then repeat")
                : uiText("Practise with your own memories")}
          </h2>
          <button
            className="icon-button"
            aria-label={uiText("Restart practice")}
            onClick={() => reset()}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        {mode === "match" && (
          <>
            <p className="muted">
              {uiText("Turn over two cards at a time.")}
              {matched.length / 2}
              {uiText("of 6 pairs found ·")}
              {moves}
              {uiText("attempts")}
            </p>
            <div className="game-grid">
              {cards.map((s, i) => (
                <button
                  key={i}
                  className={
                    opened.includes(i) || matched.includes(i) ? "revealed" : ""
                  }
                  onClick={() => flip(i)}
                  aria-label={
                    opened.includes(i) || matched.includes(i)
                      ? s
                      : `Hidden card ${i + 1}`
                  }
                >
                  {opened.includes(i) || matched.includes(i) ? s : "?"}
                </button>
              ))}
            </div>
            {matched.length === cards.length && !saved && (
              <button
                className="primary"
                disabled={saving}
                onClick={() => finish(6, Math.max(6, moves))}
              >
                <Check size={18} />
                {uiText("Save this practice")}
              </button>
            )}
          </>
        )}
        {mode === "sequence" && (
          <>
            <p className="muted">
              {uiText(
                "Remember three pictures. They will hide after a short moment.",
              )}
            </p>
            <div className="sequence-stage">
              {phase === "learn" ? (
                sequence.map((s, i) => <span key={i}>{s}</span>)
              ) : phase === "answer" ? (
                <span>{answer.join(" ") || "Your turn"}</span>
              ) : (
                <Play size={40} />
              )}
            </div>
            {phase === "ready" || phase === "done" ? (
              <button className="primary" onClick={startSequence}>
                {uiText("Start a round")}
              </button>
            ) : phase === "answer" ? (
              <div className="sequence-options">
                {symbols.map((s) => (
                  <button
                    key={s}
                    disabled={answer.length >= 3}
                    onClick={() => {
                      const next = [...answer, s];
                      setAnswer(next);
                      if (next.length === 3) {
                        setPhase("done");
                        setStatus(
                          next.join() === sequence.join()
                            ? "You remembered the sequence."
                            : "Good try. The order was " + sequence.join(" "),
                        );
                      }
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p>{uiText("Look carefully…")}</p>
            )}
            {phase === "done" && !saved && (
              <button
                className="secondary"
                disabled={saving}
                onClick={() =>
                  finish(answer.filter((s, i) => s === sequence[i]).length, 3)
                }
              >
                {uiText("Save practice")}
              </button>
            )}
          </>
        )}
        {mode === "recall" &&
          (!item ? (
            <div className="empty">
              <Brain size={38} />
              <h3>{uiText("Your memories make this personal.")}</h3>
              <p>
                {uiText(
                  "Add people or captioned photos first. We never invent names or memories.",
                )}
              </p>
            </div>
          ) : (
            <div className="recall">
              <div className="recall-photo">
                <Photo
                  id={item.photo_id}
                  profileId={profile.id}
                  vaultKey={profile.key}
                  alt={uiText("Your chosen memory")}
                />
              </div>
              {phase === "ready" ? (
                <>
                  <span className="pill">{uiText("1 · Learn")}</span>
                  <h2>{item.name || item.title}</h2>
                  <p>
                    {item.relationship} {item.caption}
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      setPhase("pause");
                      timeout.current = setTimeout(
                        () => setPhase("answer"),
                        4000,
                      );
                    }}
                  >
                    {uiText("I’m ready to remember")}
                  </button>
                </>
              ) : phase === "pause" ? (
                <>
                  <h2>{uiText("Take one slow breath.")}</h2>
                  <p>{uiText("The question will appear in a moment.")}</p>
                </>
              ) : (
                <>
                  <span className="pill">{uiText("2 · Recall")}</span>
                  <h2>
                    {item.name
                      ? uiText("Who is this person?")
                      : uiText("What do you remember about this moment?")}
                  </h2>
                  {phase === "answer" ? (
                    <button
                      className="secondary"
                      onClick={() => setPhase("reveal")}
                    >
                      {uiText("Show me the answer")}
                    </button>
                  ) : (
                    <>
                      <h3>{item.name || item.title}</h3>
                      <p>
                        {item.relationship} {item.caption}
                      </p>
                      {!saved ? (
                        <div className="form-actions">
                          <button
                            className="primary"
                            disabled={saving}
                            onClick={() => finish(1, 1)}
                          >
                            {uiText("I remembered")}
                          </button>
                          <button
                            className="secondary"
                            disabled={saving}
                            onClick={() => finish(0, 1)}
                          >
                            {uiText("I needed a reminder")}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => {
                            setIndex((i) => i + 1);
                            reset();
                          }}
                        >
                          {uiText("Next memory")}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
      </section>
      <p className="footnote">
        {uiText(
          "Practice results describe activities, not cognitive ability or a diagnosis. Stop whenever you feel tired.",
        )}
      </p>
    </>
  );
}
