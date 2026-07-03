"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

export default function NetworkPage() {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  async function run() {
    setLoading(true);
    setRan(true);
    try {
      const res = await api.network();
      setInsights(res.insights);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Network insights</h1>
      <p className="mt-1 text-sm text-neutral-500">
        This is the part a per-client vector store can&apos;t do: Clientele keeps a shared
        knowledge graph across every client, so it can surface connections you&apos;d
        otherwise never notice — shared vendors, shared events, referral opportunities.
      </p>

      <button
        onClick={run}
        disabled={loading}
        className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {loading ? "Scanning your client graph..." : "Find connections across my clients"}
      </button>

      {ran && !loading && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="text-sm leading-relaxed [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-neutral-200 [&_td]:p-2 [&_td]:align-top">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
