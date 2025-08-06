from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from backend.database import get_session, get_redis
from backend.models import ChatSession, Message, MessageCreate, SessionStatus
from backend.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}/completions")
async def start_completion(
        session_id: str,
        message: MessageCreate,
        db: Session = Depends(get_session),
        redis_client=Depends(get_redis)
):
    # 验证会话存在
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 保存用户消息
    user_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(user_message)

    # 创建AI消息占位符
    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content="",
        is_streaming=True
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    # 更新会话状态
    session.last_message_id = ai_message.id
    session.status = SessionStatus.ACTIVE
    db.commit()

    # 在Redis中存储流式状态
    redis_client.hset(f"session:{session_id}", mapping={
        "current_message_id": ai_message.id,
        "status": "streaming",
        "last_user_message": message.content
    })

    chat_service = ChatService(db, redis_client)
    return StreamingResponse(
        chat_service.stream_response(session_id, ai_message.id, message.content),
        media_type="text/plain"
    )


@router.post("/{session_id}/completions-continue")
async def continue_completion(
        session_id: str,
        db: Session = Depends(get_session),
        redis_client=Depends(get_redis)
):
    # 检查会话状态
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 从Redis获取中断的流式状态
    session_data = redis_client.hgetall(f"session:{session_id}")
    if not session_data or session_data.get("status") != "streaming":
        raise HTTPException(status_code=400, detail="No active streaming to continue")

    message_id = session_data.get("current_message_id")
    last_user_message = session_data.get("last_user_message")

    if not message_id or not last_user_message:
        raise HTTPException(status_code=400, detail="Invalid session state")

    chat_service = ChatService(db, redis_client)
    return StreamingResponse(
        chat_service.continue_stream_response(session_id, message_id, last_user_message),
        media_type="text/plain"
    )
