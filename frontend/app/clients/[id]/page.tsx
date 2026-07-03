"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, Client, NoteMeta } from "@/lib/api";

type ChatTurn = { role: "user" | "assistant"; text: string };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState("note");
  const [savingNote, setSavingNote] = useState(false);

  const [briefing, setBriefing] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [briefing_loading, setBriefingLoading] = useState(false);

  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correctionDone, setCorrectionDone] = useState(false);

  const [offboarding, setOffboarding] = useState(false);
  const [confirmOffboard, setConfirmOffboard] = useState(false);

  function load() {
    setLoading(true);
    api
      .getClient(clientId)
      .then((d) => {
        setClient(d.client);
        setNotes(d.notes);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (clientId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.addNote(clientId, noteText, noteKind);
      setNoteText("");
      load();
    } finally {
      setSavingNote(false);
    }
  }

  async function handleBrief() {
    setBriefingLoading(true);
    setChat([]);
    setCorrectionMode(false);
    setCorrectionDone(false);
    try {
      const res = await api.brief(clientId);
      setBriefing(res.briefing);
      setSessionId(res.session_id);
    } finally {
      setBriefingLoading(false);
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !sessionId) return;
    const q = question;
    setQuestion("");
    setChat((c) => [...c, { role: "user", text: q }]);
    setAsking(true);
    try {
      const res = await api.chat(clientId, sessionId, q);
      setChat((c) => [...c, { role: "assistant", text: res.answer }]);
    } finally {
      setAsking(false);
    }
  }

  async function handleCorrect(e: React.FormEvent) {
    e.preventDefault();
    if (!correctionText.trim() || !sessionId) return;
    setCorrecting(true);
    try {
      await api.correct(clientId, sessionId, correctionText);
      setCorrectionText("");
      setCorrectionMode(false);
      setCorrectionDone(true);
    } finally {
      setCorrecting(false);
    }
  }

  async function handleOffboard() {
    setOffboarding(true);
    try {
      await api.offboardClient(clientId);
      router.push("/");
    } finally {
      setOffboarding(false);
    }
  }

  if (loading || !client) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-neutral-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-neutral-500">
            {client.role} {client.role && client.company ? "at" : ""} {client.company}
          </p>
          {client.tags && (
            <div className="mt-2 flex gap-2">
              {client.tags.split(",").filter(Boolean).map((t) => (
                <span key={t} className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">
                  {t.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setConfirmOffboard(true)}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          Offboard client
        </button>
      </div>

      {confirmOffboard && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="mb-3 text-red-800">
            This permanently deletes everything Clientele remembers about {client.name} (calls Cognee&apos;s{" "}
            <code className="rounded bg-red-100 px-1">forget()</code>). This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleOffboard}
              disabled={offboarding}
              className="rounded-md bg-red-600 px-3 py-1.5 text-white disabled:opacity-50"
            >
              {offboarding ? "Forgetting..." : "Yes, forget this client"}
            </button>
            <button
              onClick={() => setConfirmOffboard(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Brief me */}
      <section className="mb-8">
        <button
          onClick={handleBrief}
          disabled={briefing_loading}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {briefing_loading ? "Pulling up what I know..." : "Brief me before my next meeting"}
        </button>

        {briefing && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Briefing
            </div>
            <div className="text-sm leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
            </div>

            <div className="mt-4 border-t border-neutral-100 pt-3">
              {!correctionMode && !correctionDone && (
                <button
                  onClick={() => setCorrectionMode(true)}
                  className="text-xs text-neutral-500 underline hover:text-neutral-800"
                >
                  Something wrong in here? Correct it
                </button>
              )}
              {correctionDone && (
                <p className="text-xs text-green-700">
                  Got it — Cognee has re-ingested and re-graphed the correction.
                </p>
              )}
              {correctionMode && (
                <form onSubmit={handleCorrect} className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    placeholder="e.g. Actually his kid's name is Max, not Jack"
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    disabled={correcting}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {correcting ? "Saving..." : "Fix it"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {sessionId && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Ask about {client.name}
            </div>
            <div className="mb-2 space-y-2">
              {chat.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === "user"
                      ? "ml-auto max-w-[80%] rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white"
                      : "max-w-[80%] rounded-lg bg-neutral-100 px-3 py-2 text-sm"
                  }
                >
                  {turn.role === "assistant" ? (
                    <div className="[&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                    </div>
                  ) : (
                    turn.text
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What did we last agree on pricing?"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                disabled={asking}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                {asking ? "..." : "Ask"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Add note */}
      <section className="mb-8 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Log an interaction
        </div>
        <form onSubmit={handleAddNote}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Paste a note, email, or call summary..."
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <select
              value={noteKind}
              onChange={(e) => setNoteKind(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="note">Note</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
            </select>
            <button
              disabled={savingNote}
              className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {savingNote ? "Remembering..." : "Remember this"}
            </button>
          </div>
        </form>
      </section>

      {/* Timeline */}
      <section>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Timeline
        </div>
        <div className="space-y-2">
          {notes.length === 0 && <p className="text-sm text-neutral-500">Nothing logged yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-400">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 uppercase">{n.kind}</span>
                <span>{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {n.preview}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
