import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class ChatSession(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: Optional[str] = None
    status: SessionStatus = Field(default=SessionStatus.ACTIVE)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_message_id: Optional[str] = None


class Message(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="chatsession.id")
    role: str  # "user" or "assistant"
    content: str
    is_streaming: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MessageCreate(SQLModel):
    content: str


class SessionCreate(SQLModel):
    title: Optional[str] = None
