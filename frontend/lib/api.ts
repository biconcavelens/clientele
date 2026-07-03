const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Client = {
  id: number;
  name: string;
  role: string;
  company: string;
  tags: string;
  last_contact: string | null;
  offboarded: boolean;
  created_at: string;
};

export type NoteMeta = {
  id: number;
  client_id: number;
  kind: string;
  preview: string;
  created_at: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  listClients: () => req<Client[]>("/api/clients"),
  createClient: (data: { name: string; role: string; company: string; tags: string }) =>
    req<Client>("/api/clients", { method: "POST", body: JSON.stringify(data) }),
  getClient: (id: number) => req<{ client: Client; notes: NoteMeta[] }>(`/api/clients/${id}`),
  offboardClient: (id: number) => req<{ status: string }>(`/api/clients/${id}`, { method: "DELETE" }),
  addNote: (id: number, text: string, kind: string) =>
    req<NoteMeta>(`/api/clients/${id}/notes`, { method: "POST", body: JSON.stringify({ text, kind }) }),
  brief: (id: number) => req<{ session_id: string; briefing: string }>(`/api/clients/${id}/brief`, { method: "POST" }),
  chat: (id: number, session_id: string, question: string) =>
    req<{ answer: string }>(`/api/clients/${id}/chat`, { method: "POST", body: JSON.stringify({ session_id, question }) }),
  correct: (id: number, session_id: string, correction_text: string) =>
    req<{ status: string }>(`/api/clients/${id}/correct`, { method: "POST", body: JSON.stringify({ session_id, correction_text }) }),
  network: () => req<{ insights: string }>("/api/network"),
};
