import os
from typing import AsyncGenerator, Dict, List

from openai import AsyncOpenAI
from sqlmodel import Session

from backend.models import Message
from .error_handler import handle_openai_errors, StreamErrorHandler


class OpenAIService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_API_BASE_URL", "https://api.openai.com/v1"),
        )
        self.model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))

    async def get_chat_messages(self, db: Session, session_id: str) -> List[Dict[str, str]]:
        """获取会话历史消息，转换为OpenAI格式"""
        from sqlmodel import select
        messages = db.exec(
            select(Message)
            .where(Message.session_id == session_id)
            .where(Message.is_streaming == False)
            .order_by(Message.created_at)
        ).all()

        openai_messages = []
        for msg in messages:
            if msg.content.strip():  # 过滤空消息
                openai_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        # 如果没有历史消息，添加系统提示
        if not openai_messages:
            openai_messages.append({
                "role": "system",
                "content": "你是一个有用的AI助手，请用中文回答用户的问题。"
            })

        return openai_messages

    async def stream_chat_completion(
            self,
            db: Session,
            session_id: str,
            user_message: str
    ) -> AsyncGenerator[Dict, None]:
        """流式获取OpenAI回复（带错误处理）"""
        async for result in StreamErrorHandler.handle_stream_errors(
                self._internal_stream_chat_completion,
                db, session_id, user_message
        ):
            yield result

    @handle_openai_errors
    async def _internal_stream_chat_completion(
            self,
            db: Session,
            session_id: str,
            user_message: str
    ) -> AsyncGenerator[Dict, None]:
        """内部流式聊天完成方法"""
        # 获取会话历史
        messages = await self.get_chat_messages(db, session_id)

        # 添加新的用户消息
        messages.append({
            "role": "user",
            "content": user_message
        })

        # 调用OpenAI流式API
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    yield {
                        "type": "content",
                        "content": delta.content,
                        "finish_reason": chunk.choices[0].finish_reason
                    }
                elif chunk.choices[0].finish_reason:
                    yield {
                        "type": "done",
                        "finish_reason": chunk.choices[0].finish_reason
                    }

    async def continue_chat_completion(
            self,
            db: Session,
            session_id: str,
            user_message: str,
            existing_content: str = ""
    ) -> AsyncGenerator[Dict, None]:
        """继续中断的聊天流式回复（带错误处理）"""
        async for result in StreamErrorHandler.handle_stream_errors(
                self._internal_continue_chat_completion,
                db, session_id, user_message, existing_content
        ):
            yield result

    @handle_openai_errors
    async def _internal_continue_chat_completion(
            self,
            db: Session,
            session_id: str,
            user_message: str,
            existing_content: str = ""
    ) -> AsyncGenerator[Dict, None]:
        """内部继续聊天完成方法"""
        # 获取会话历史
        messages = await self.get_chat_messages(db, session_id)
        messages.insert(0, {"role": "system", "content": "续写未完成的回答"})
        # 添加用户消息和已有的助手回复
        messages.append({
            "role": "user",
            "content": user_message
        })

        if existing_content:
            messages.append({
                "role": "assistant",
                "content": existing_content
            })

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    yield {
                        "type": "content",
                        "content": delta.content,
                        "finish_reason": chunk.choices[0].finish_reason
                    }
                elif chunk.choices[0].finish_reason:
                    yield {
                        "type": "done",
                        "finish_reason": chunk.choices[0].finish_reason
                    }
