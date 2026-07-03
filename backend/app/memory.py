"""
Thin wrapper around Cognee Cloud's REST API: remember() / recall() / forget().

Confirmed against the live tenant's OpenAPI schema (2026-07-02):
- POST /api/v1/remember  is multipart/form-data (data is an uploaded file part)
- POST /api/v1/recall    is JSON, camelCase fields (query, datasets, sessionId, topK)
- POST /api/v1/forget    is JSON, camelCase fields (dataset, dataId, everything, memoryOnly)
- There is no /improve endpoint on Cloud. Corrections are applied by re-remembering
  the corrected fact (tagged "correction"), which cognee re-ingests and re-graphs.

MOCK_MODE lets the rest of the app run without hitting the network - flip
MOCK_MODE=false in .env once COGNEE_API_KEY / COGNEE_BASE_URL are set.
"""
import asyncio
import os
import uuid
from typing import List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() != "false"

BASE_URL = (os.getenv("COGNEE_BASE_URL") or os.getenv("COGNEE_SERVICE_URL") or "").rstrip("/")
API_KEY = os.getenv("COGNEE_API_KEY", "")

NETWORK_DATASET = "workspace_network"

_HEADERS = {"X-Api-Key": API_KEY}


def client_dataset(client_id: int) -> str:
    return f"client_{client_id}"


def new_session_id() -> str:
    return str(uuid.uuid4())


# ---- low-level REST calls -----------------------------------------------

async def _remember(text: str, dataset_name: str, node_set: List[str], session_id: Optional[str] = None) -> dict:
    # NOTE: httpx 0.27/0.28 has a bug where files=<list of tuples> combined with
    # data=<list of tuples> raises "Attempted to send a sync request with an
    # AsyncClient instance." Using a dict (with a list value for the repeated
    # node_set field) avoids it and is the documented way to send array fields.
    form: dict = {"datasetName": dataset_name, "run_in_background": "false"}
    if node_set:
        form["node_set"] = node_set
    if session_id:
        form["session_id"] = session_id

    # A dataset that was just forget()-deleted can briefly 409 on the next
    # remember() while the delete finishes propagating server-side. Retry
    # a couple of times with backoff rather than failing a whole seed run.
    last_exc: Optional[Exception] = None
    for attempt in range(3):
        files = [("data", ("note.txt", text.encode("utf-8"), "text/plain"))]
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(f"{BASE_URL}/api/v1/remember", headers=_HEADERS, files=files, data=form)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            last_exc = e
            if e.response.status_code == 409 and attempt < 2:
                await asyncio.sleep(3 * (attempt + 1))
                continue
            raise
    raise last_exc


async def _recall(query: str, datasets: Optional[List[str]] = None, session_id: Optional[str] = None, top_k: int = 15) -> list:
    payload: dict = {"query": query, "topK": top_k}
    if datasets:
        payload["datasets"] = datasets
    if session_id:
        payload["sessionId"] = session_id
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BASE_URL}/api/v1/recall",
            headers={**_HEADERS, "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def _forget(dataset: Optional[str] = None, data_id: Optional[str] = None, everything: bool = False) -> dict:
    payload: dict = {"everything": everything}
    if dataset:
        payload["dataset"] = dataset
    if data_id:
        payload["dataId"] = data_id
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{BASE_URL}/api/v1/forget",
            headers={**_HEADERS, "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def _extract_text(results: list) -> str:
    if not results:
        return "I don't have anything remembered for this yet — log a note first."
    parts = [r.get("text", "") for r in results if isinstance(r, dict) and r.get("text")]
    return "\n\n".join(parts) if parts else str(results)


# ---- MOCK DATA (used until COGNEE_API_KEY is wired in) ----------------

_MOCK_BRIEFING = """**Since you last spoke ({name}):**
- Raised concerns about Q3 budget approval timing
- Mentioned their kid is starting college in the fall
- Asked for a follow-up proposal by end of week

**Open action items:**
- Send revised pricing tier (promised last Tuesday)
- Loop in design team for the mockup they requested

**Worth remembering:** prefers async updates over calls, based in Austin.

**Avoid bringing up:** the Q2 delivery delay — already smoothed over, no need to reopen it.
"""

_MOCK_CHAT_ANSWER = "Based on your notes, {name} last asked about pricing flexibility for a multi-year contract, and you agreed to send options by Friday."

_MOCK_NETWORK = """**Connections found across your clients:**

- **Acme Corp (Dana Reyes)** and **Northwind Retail (Marcus Chen)** both mentioned struggling with the same inventory-sync vendor — worth a warm introduction, they could compare notes.
- **Acme Corp** and **Bluepeak Studios** both have people who went to the same conference (DevSummit) last quarter — a natural talking point for your next call with either.
- **Northwind Retail** is hiring for a role that **Bluepeak Studios'** contact mentioned their former teammate is looking for — a possible referral opportunity for you to broker.
"""


# ---- PUBLIC API ---------------------------------------------------------

async def remember_note(client_id: int, client_name: str, text: str, kind: str) -> dict:
    if MOCK_MODE:
        return {"status": "mocked", "items_processed": 1}

    tag = f"client:{client_id}"
    await _remember(text, dataset_name=client_dataset(client_id), node_set=[kind, tag])
    # Also feed a shared graph so cross-client relationships can be reasoned
    # over later (this is what a plain per-client vector store can't do).
    await _remember(f"[{client_name}] {text}", dataset_name=NETWORK_DATASET, node_set=[kind, tag, client_name])
    return {"status": "ok"}


async def recall_briefing(client_id: int, client_name: str, session_id: str) -> str:
    if MOCK_MODE:
        return _MOCK_BRIEFING.format(name=client_name)

    prompt = (
        f"Give me a briefing before my next meeting with {client_name}: "
        "recent history, open action items, personal details worth remembering, "
        "and anything sensitive I should avoid bringing up."
    )
    results = await _recall(prompt, datasets=[client_dataset(client_id)], session_id=session_id)
    return _extract_text(results)


async def recall_chat(client_id: int, client_name: str, session_id: str, question: str) -> str:
    if MOCK_MODE:
        return _MOCK_CHAT_ANSWER.format(name=client_name)

    results = await _recall(question, datasets=[client_dataset(client_id)], session_id=session_id)
    return _extract_text(results)


async def correct_memory(client_id: int, session_id: str, correction_text: str) -> dict:
    if MOCK_MODE:
        return {"status": "mocked"}

    # No /improve endpoint on Cloud - corrections are applied by re-remembering
    # the corrected fact, which cognee re-ingests and re-graphs.
    #
    # IMPORTANT: session_id must NOT be passed here. remember() with a
    # session_id routes to session-cache-only storage (status="session_stored",
    # items_processed=0) instead of the permanent dataset graph, so the
    # correction would never actually reach recall(). Confirmed by testing
    # directly against the live API.
    await _remember(
        f"CORRECTION: {correction_text}",
        dataset_name=client_dataset(client_id),
        node_set=["correction"],
    )
    return {"status": "ok"}


async def forget_client(client_id: int) -> dict:
    if MOCK_MODE:
        return {"status": "mocked"}

    await _forget(dataset=client_dataset(client_id))
    return {"status": "ok"}


async def recall_network() -> str:
    if MOCK_MODE:
        return _MOCK_NETWORK

    prompt = (
        "Looking across all clients in this workspace, find meaningful connections: "
        "shared companies, shared topics or interests, overlapping problems, or people "
        "mentioned in common. For each connection, name the clients involved and explain "
        "why it matters (e.g. a possible introduction, a shared risk, a timely opportunity)."
    )
    results = await _recall(prompt, datasets=[NETWORK_DATASET])
    return _extract_text(results)
