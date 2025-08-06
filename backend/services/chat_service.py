import json

from backend.models import Message
from sqlmodel import Session

from .openai_service import OpenAIService


class ChatService:
    def __init__(self, db: Session, redis_client):
        self.db = db
        self.redis = redis_client
        self.openai_service = OpenAIService()

    async def stream_response(self, session_id: str, message_id: str, user_input: str):
        """使用OpenAI GPT-4进行流式响应"""
        accumulated_content = ""

        try:
            async for chunk in self.openai_service.stream_chat_completion(
                    self.db, session_id, user_input
            ):
                if chunk["type"] == "content":
                    accumulated_content += chunk["content"]

                    # 构造SSE格式的数据
                    data = {
                        "type": "content",
                        "content": chunk["content"],
                        "message_id": message_id,
                        "accumulated": accumulated_content
                    }

                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

                    # 更新Redis中的当前内容
                    self.redis.hset(f"message:{message_id}", "content", accumulated_content)

                elif chunk["type"] == "done":
                    # 流式完成，更新数据库
                    message = self.db.get(Message, message_id)
                    if message:
                        message.content = accumulated_content
                        message.is_streaming = False
                        self.db.commit()

                    # 清理Redis流式状态
                    self.redis.hdel(f"session:{session_id}", "current_message_id", "status")
                    self.redis.delete(f"message:{message_id}")

                    # 发送完成信号
                    completion_data = {
                        "type": "done",
                        "message_id": message_id,
                        "total_content": accumulated_content
                    }
                    yield f"data: {json.dumps(completion_data, ensure_ascii=False)}\n\n"
                    break

                elif chunk["type"] == "retry":
                    # 转发重试信息给前端
                    retry_data = {
                        "type": "retry",
                        "message": chunk["message"],
                        "attempt": chunk["attempt"]
                    }
                    yield f"data: {json.dumps(retry_data, ensure_ascii=False)}\n\n"

                elif chunk["type"] == "error":
                    raise Exception(chunk["error"])

        except Exception as e:
            # 保存已生成的部分内容
            if accumulated_content:
                message = self.db.get(Message, message_id)
                if message:
                    message.content = accumulated_content
                    message.is_streaming = False
                    self.db.commit()

            error_data = {
                "type": "error",
                "error": str(e),
                "message_id": message_id,
                "partial_content": accumulated_content
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"

    async def continue_stream_response(self, session_id: str, message_id: str, user_input: str):
        """继续中断的OpenAI流式响应"""
        existing_content = self.redis.hget(f"message:{message_id}", "content") or ""
        accumulated_content = existing_content

        try:
            # 先发送恢复信号
            resume_data = {
                "type": "resume",
                "message_id": message_id,
                "existing_content": existing_content
            }
            yield f"data: {json.dumps(resume_data, ensure_ascii=False)}\n\n"

            # 继续OpenAI流式输出
            async for chunk in self.openai_service.continue_chat_completion(
                    self.db, session_id, user_input, existing_content
            ):
                if chunk["type"] == "content":
                    accumulated_content += chunk["content"]

                    data = {
                        "type": "content",
                        "content": chunk["content"],
                        "message_id": message_id,
                        "accumulated": accumulated_content
                    }

                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

                    # 更新Redis
                    self.redis.hset(f"message:{message_id}", "content", accumulated_content)

                elif chunk["type"] == "done":
                    # 完成处理
                    message = self.db.get(Message, message_id)
                    if message:
                        message.content = accumulated_content
                        message.is_streaming = False
                        self.db.commit()

                    # 清理状态
                    self.redis.hdel(f"session:{session_id}", "current_message_id", "status")
                    self.redis.delete(f"message:{message_id}")

                    completion_data = {
                        "type": "done",
                        "message_id": message_id,
                        "total_content": accumulated_content
                    }
                    yield f"data: {json.dumps(completion_data, ensure_ascii=False)}\n\n"
                    break

                elif chunk["type"] == "retry":
                    # 转发重试信息给前端
                    retry_data = {
                        "type": "retry",
                        "message": chunk["message"],
                        "attempt": chunk["attempt"]
                    }
                    yield f"data: {json.dumps(retry_data, ensure_ascii=False)}\n\n"

                elif chunk["type"] == "error":
                    raise Exception(chunk["error"])

        except Exception as e:
            # 保存部分内容
            if accumulated_content != existing_content:
                message = self.db.get(Message, message_id)
                if message:
                    message.content = accumulated_content
                    message.is_streaming = False
                    self.db.commit()

            error_data = {
                "type": "error",
                "error": str(e),
                "message_id": message_id,
                "partial_content": accumulated_content
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
