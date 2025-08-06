from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.database import get_session, get_redis
from backend.models import SessionCreate, ChatSession, Message

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=ChatSession)
def create_session(
        session_data: SessionCreate,
        db: Session = Depends(get_session),
        redis_client=Depends(get_redis)
):
    session = ChatSession(title=session_data.title)
    db.add(session)
    db.commit()
    db.refresh(session)

    # 在Redis中初始化会话状态
    redis_client.hset(f"session:{session.id}", mapping={
        "status": session.status,
        "created_at": session.created_at.isoformat(),
        "message_count": "0"
    })

    return session


@router.get("/{session_id}", response_model=ChatSession)
def get_session(
        session_id: str,
        db: Session = Depends(get_session)
):
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/{session_id}/messages", response_model=List[Message])
def get_session_messages(
        session_id: str,
        db: Session = Depends(get_session)
):
    messages = db.exec(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
    ).all()
    return messages


@router.get("/", response_model=List[ChatSession])
def get_sessions(
        db: Session = Depends(get_session)
):
    sessions = db.exec(select(ChatSession).order_by(ChatSession.updated_at.desc())).all()
    return sessions
