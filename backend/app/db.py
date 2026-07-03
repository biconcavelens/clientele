from datetime import datetime
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, select

engine = create_engine("sqlite:///./clientele.db", connect_args={"check_same_thread": False})


class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str = ""
    company: str = ""
    tags: str = ""  # comma-separated
    last_contact: Optional[datetime] = None
    offboarded: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class NoteMeta(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="client.id")
    kind: str  # note | email | call | correction
    preview: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
