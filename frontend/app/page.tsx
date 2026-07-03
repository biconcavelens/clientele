"use client";

import { useEffect, useState } from "react";
import { api, Client } from "@/lib/api";

function daysAgo(iso: string | null): string {
  if (!iso) return "never contacted";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days >= 30;
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", company: "", tags: "" });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api.listClients().then(setClients).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.createClient(form);
      setForm({ name: "", role: "", company: "", tags: "" });
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your clients</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Never walk into a meeting having forgotten what matters.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          {showForm ? "Cancel" : "+ Add client"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-5"
        >
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            disabled={submitting}
            className="col-span-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save client"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-neutral-500">No clients yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <a
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {isStale(c.last_contact) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      needs a check-in
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500">
                  {c.role} {c.role && c.company ? "at" : ""} {c.company}
                </div>
              </div>
              <div className="text-right text-sm text-neutral-400">
                last contact: {daysAgo(c.last_contact)}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
