from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from . import memory
from .db import Client, NoteMeta, engine, init_db

app = FastAPI(title="Clientele API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ---- schemas -------------------------------------------------------------

class ClientCreate(BaseModel):
    name: str
    role: str = ""
    company: str = ""
    tags: str = ""


class NoteCreate(BaseModel):
    text: str
    kind: str = "note"


class ChatRequest(BaseModel):
    session_id: str
    question: str


class CorrectRequest(BaseModel):
    session_id: str
    correction_text: str


# ---- roster ---------------------------------------------------------------

@app.get("/api/clients")
def list_clients():
    with Session(engine) as session:
        clients = session.exec(
            select(Client).where(Client.offboarded == False).order_by(Client.last_contact.desc().nullslast())
        ).all()
        return clients


@app.post("/api/clients")
def create_client(payload: ClientCreate):
    with Session(engine) as session:
        client = Client(**payload.model_dump())
        session.add(client)
        session.commit()
        session.refresh(client)
        return client


@app.get("/api/clients/{client_id}")
def get_client(client_id: int):
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            raise HTTPException(404, "Client not found")
        notes = session.exec(
            select(NoteMeta).where(NoteMeta.client_id == client_id).order_by(NoteMeta.created_at.desc())
        ).all()
        return {"client": client, "notes": notes}


@app.delete("/api/clients/{client_id}")
async def offboard_client(client_id: int):
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            raise HTTPException(404, "Client not found")
        await memory.forget_client(client_id)
        client.offboarded = True
        session.add(client)
        session.commit()
        return {"status": "offboarded"}


# ---- notes / memory ---------------------------------------------------------

@app.post("/api/clients/{client_id}/notes")
async def add_note(client_id: int, payload: NoteCreate):
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            raise HTTPException(404, "Client not found")

        await memory.remember_note(client_id, client.name, payload.text, payload.kind)

        note = NoteMeta(
            client_id=client_id,
            kind=payload.kind,
            preview=payload.text[:140],
        )
        session.add(note)
        client.last_contact = datetime.utcnow()
        session.add(client)
        session.commit()
        session.refresh(note)
        return note


@app.post("/api/clients/{client_id}/brief")
async def brief_client(client_id: int):
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            raise HTTPException(404, "Client not found")

    session_id = memory.new_session_id()
    briefing = await memory.recall_briefing(client_id, client.name, session_id)
    return {"session_id": session_id, "briefing": briefing}


@app.post("/api/clients/{client_id}/chat")
async def chat_client(client_id: int, payload: ChatRequest):
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            raise HTTPException(404, "Client not found")

    answer = await memory.recall_chat(client_id, client.name, payload.session_id, payload.question)
    return {"answer": answer}


@app.post("/api/clients/{client_id}/correct")
async def correct_client(client_id: int, payload: CorrectRequest):
    result = await memory.correct_memory(client_id, payload.session_id, payload.correction_text)
    return result


# ---- network insights (cross-client graph reasoning) ------------------------

@app.get("/api/network")
async def network_insights():
    insights = await memory.recall_network()
    return {"insights": insights}
