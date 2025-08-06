import asyncio
import logging
from typing import AsyncGenerator, Dict, Callable, Any
from openai import APIError, APIConnectionError, RateLimitError

logger = logging.getLogger(__name__)

class ErrorHandler:
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
    
    async def retry_with_exponential_backoff(
        self, 
        func: Callable,
        *args,
        **kwargs
    ) -> AsyncGenerator[Dict, None]:
        """带指数退避的重试机制"""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                async for result in func(*args, **kwargs):
                    yield result
                return  # 成功完成，退出重试循环
                
            except RateLimitError as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"Rate limit hit, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})")
                    yield {
                        "type": "retry",
                        "message": f"API调用频率限制，{delay}秒后重试...",
                        "attempt": attempt + 1
                    }
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Max retries exceeded for rate limit: {e}")
                    break
                    
            except APIConnectionError as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"Connection error, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})")
                    yield {
                        "type": "retry",
                        "message": f"网络连接错误，{delay}秒后重试...",
                        "attempt": attempt + 1
                    }
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Max retries exceeded for connection error: {e}")
                    break
                    
            except APIError as e:
                last_exception = e
                # API错误通常不需要重试（除非是临时错误）
                if e.status_code in [500, 502, 503, 504] and attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(f"Server error {e.status_code}, retrying in {delay}s")
                    yield {
                        "type": "retry",
                        "message": f"服务器错误，{delay}秒后重试...",
                        "attempt": attempt + 1
                    }
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"API error (no retry): {e}")
                    break
                    
            except Exception as e:
                last_exception = e
                logger.error(f"Unexpected error: {e}")
                break
        
        # 所有重试都失败了
        yield {
            "type": "error",
            "error": f"重试{self.max_retries}次后仍然失败: {str(last_exception)}"
        }

class StreamErrorHandler:
    """专门处理流式响应中的错误"""
    
    @staticmethod
    async def handle_stream_errors(
        stream_func: Callable,
        *args,
        **kwargs
    ) -> AsyncGenerator[Dict, None]:
        """处理流式响应中的错误"""
        error_handler = ErrorHandler(max_retries=2)
        
        try:
            async for result in error_handler.retry_with_exponential_backoff(
                stream_func, *args, **kwargs
            ):
                if result.get("type") == "retry":
                    # 向前端发送重试状态
                    yield result
                elif result.get("type") == "error":
                    # 最终错误
                    yield result
                    break
                else:
                    # 正常的流式数据
                    yield result
                    
        except Exception as e:
            logger.error(f"Unhandled error in stream handler: {e}")
            yield {
                "type": "error",
                "error": f"未处理的流式错误: {str(e)}"
            }

# 全局错误处理装饰器
def handle_openai_errors(func):
    """OpenAI API调用错误处理装饰器"""
    async def wrapper(*args, **kwargs):
        try:
            async for result in func(*args, **kwargs):
                yield result
        except RateLimitError as e:
            yield {
                "type": "error",
                "error": f"API调用频率限制: {str(e)}"
            }
        except APIConnectionError as e:
            yield {
                "type": "error", 
                "error": f"网络连接错误: {str(e)}"
            }
        except APIError as e:
            yield {
                "type": "error",
                "error": f"OpenAI API错误: {str(e)}"
            }
        except Exception as e:
            yield {
                "type": "error",
                "error": f"未知错误: {str(e)}"
            }
    return wrapper