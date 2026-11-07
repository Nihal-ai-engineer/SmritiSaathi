import { translate as uiText } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Download,
  LockKeyhole,
  MessageCircle,
  LoaderCircle,
} from "lucide-react";
import type { MLCEngine } from "@mlc-ai/web-llm";
export default function LocalAssistant() {
  const engine = useRef<MLCEngine | null>(null),
    alive = useRef(true);
  const [loading, setLoading] = useState(false),
    [ready, setReady] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      engine.current?.interruptGenerate();
      void engine.current?.unload();
    };
  }, []);
  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!("gpu" in navigator))
        throw new Error(
          "On-device AI needs WebGPU. Open this local app in a recent Chrome or Edge browser.",
        );
      const webllm = await import("@mlc-ai/web-llm");
      const model = webllm.prebuiltAppConfig.model_list.find(
        (m) => m.model_id === "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      );
      if (!model)
        throw new Error("The local model is unavailable in this build.");
      const loaded = await webllm.CreateMLCEngine(model.model_id, {
        initProgressCallback: (r) => {
          if (alive.current) setProgress(r.text);
        },
      });
      if (!alive.current) {
        await loaded.unload();
        return;
      }
      engine.current = loaded;
      setReady(true);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!engine.current || !input.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ];
    setInput("");
    setMessages(next);
    setBusy(true);
    setError("");
    try {
      const result = await engine.current.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are Saathi, a calm daily companion. Use short, respectful sentences. Never invent personal information, names, memories, appointments or medication instructions. You have no access to the user’s records. Never diagnose, prescribe, recommend doses or claim to stop brain damage. For medical questions suggest the person’s clinician. For immediate danger advise local emergency help. Do not claim that you contacted anyone or performed an action. Respond in the language the user uses.",
          },
          ...next.slice(-8),
        ],
        max_tokens: 220,
        temperature: 0.4,
      });
      if (alive.current)
        setMessages([
          ...next,
          {
            role: "assistant",
            content: result.choices[0]?.message.content || "Please try again.",
          },
        ]);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{uiText("A QUIET CONVERSATION")}</span>
          <h1>{uiText("Ask Saathi")}</h1>
          <p>
            {uiText(
              "Your conversation stays on this device and disappears when you leave this screen.",
            )}
          </p>
        </div>
        <span className="pill">
          <LockKeyhole size={16} />
          {uiText("Local AI")}
        </span>
      </div>
      <section className="panel assistant-panel">
        {!ready ? (
          <div className="empty">
            <MessageCircle size={42} />
            <h2>{uiText("A companion on your device.")}</h2>
            <p>
              {uiText(
                "Download the language model once (approximately 1 GB). Your browser will then generate replies locally using your device’s GPU. No chat text goes to an AI service.",
              )}
            </p>
            <p className="muted small">
              {uiText(
                "The model provider receives the model download request. Internet may be needed again if your browser clears its cache.",
              )}
            </p>
            <button className="primary" disabled={loading} onClick={load}>
              {loading ? (
                <LoaderCircle className="spin" />
              ) : (
                <Download size={18} />
              )}{" "}
              {loading
                ? uiText("Loading on your device…")
                : uiText("Download & start local AI")}
            </button>
            {loading && <p role="status">{progress}</p>}
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="empty">
                  <MessageCircle size={34} />
                  <h3>{uiText("What would you like to talk about?")}</h3>
                  <p>
                    {uiText(
                      "Saathi can offer conversation and simple explanations. It cannot see your private records or manage your care.",
                    )}
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-message ${m.role}`}>
                  <small>
                    {m.role === "user" ? uiText("You") : uiText("Saathi")}
                  </small>
                  <p>{m.content}</p>
                </div>
              ))}
              {busy && (
                <p role="status">
                  {uiText("Saathi is thinking on your device…")}
                </p>
              )}
            </div>
            <form className="chat-input" onSubmit={send}>
              <input
                aria-label={uiText("Your message")}
                maxLength={1500}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={uiText("Type a message…")}
              />
              <button
                className="primary"
                disabled={busy || !input.trim()}
                aria-label={uiText("Send message")}
              >
                <ArrowUp size={20} />
              </button>
            </form>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <p className="footnote">
        {uiText(
          "AI can be wrong. Use your care team for medical decisions. Saathi is not an emergency service.",
        )}
      </p>
    </>
  );
}
