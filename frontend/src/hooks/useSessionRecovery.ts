import { useState, useEffect } from 'react';
import { chatApi } from '../api';
import { useSSE } from './useSSE';
import { SSEData } from '../types';

const SESSION_STORAGE_KEY = 'streamchat_session_id';
const STREAMING_STATE_KEY = 'streamchat_streaming_state';
const RECOVERY_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时过期
const MAX_RETRY_COUNT = 5; // 最大重试次数

interface StreamingState {
  sessionId: string;
  isStreaming: boolean;
  lastMessageId?: string;
  timestamp: number; // 添加时间戳用于过期检查
  retryCount?: number; // 重试次数
}

export const useSessionRecovery = () => {
  const [shouldRecover, setShouldRecover] = useState(false);
  const [recoverySessionId, setRecoverySessionId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { startStream } = useSSE();

  useEffect(() => {
    // 检查页面加载时是否有中断的流式对话
    const savedState = localStorage.getItem(STREAMING_STATE_KEY);
    if (savedState) {
      try {
        const state: StreamingState = JSON.parse(savedState);
        const now = Date.now();
        
        // 检查状态是否过期
        if (state.timestamp && (now - state.timestamp) > RECOVERY_EXPIRE_TIME) {
          console.log('Recovery state expired, removing...');
          localStorage.removeItem(STREAMING_STATE_KEY);
          return;
        }
        
        if (state.isStreaming && state.sessionId) {
          // 检查是否超过最大重试次数
          const currentRetryCount = state.retryCount || 0;
          if (currentRetryCount < MAX_RETRY_COUNT) {
            setShouldRecover(true);
            setRecoverySessionId(state.sessionId);
            setRetryCount(currentRetryCount);
          } else {
            console.log('Recovery retry count exceeded, removing state...');
            localStorage.removeItem(STREAMING_STATE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to parse streaming state:', error);
        localStorage.removeItem(STREAMING_STATE_KEY);
      }
    }
  }, []);

  const saveStreamingState = (sessionId: string, isStreaming: boolean, messageId?: string) => {
    // 获取当前重试次数，如果是新的会话就重置为0
    const currentState = localStorage.getItem(STREAMING_STATE_KEY);
    let currentRetryCount = 0;
    
    if (currentState) {
      try {
        const parsed = JSON.parse(currentState);
        // 只有同一个会话才保留重试次数
        if (parsed.sessionId === sessionId) {
          currentRetryCount = parsed.retryCount || 0;
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    const state: StreamingState = {
      sessionId,
      isStreaming,
      lastMessageId: messageId,
      timestamp: Date.now(), // 保存当前时间戳
      retryCount: currentRetryCount,
    };
    localStorage.setItem(STREAMING_STATE_KEY, JSON.stringify(state));
  };

  const clearStreamingState = () => {
    localStorage.removeItem(STREAMING_STATE_KEY);
  };

  const saveCurrentSession = (sessionId: string) => {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  };

  const getCurrentSession = (): string | null => {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  };

  const recoverStream = async (sessionId: string, onData: (data: SSEData) => void) => {
    try {
      const response = await chatApi.continueCompletion(sessionId);
      if (response.ok) {
        startStream(response, (data) => {
          onData(data);
          
          // 只有在流式成功完成时才清理状态，出错时保留以便重试
          if (data.type === 'done') {
            clearStreamingState();
          } else if (data.type === 'error') {
            // 错误时增加重试次数并保存状态
            incrementRetryCount(sessionId);
            console.warn('Stream error occurred, keeping recovery state for retry');
          }
        });
        return true;
      }
      // API调用失败时增加重试次数
      incrementRetryCount(sessionId);
      console.warn('API call failed, keeping recovery state for retry');
      return false;
    } catch (error) {
      console.error('Failed to recover stream:', error);
      // 网络错误时增加重试次数
      incrementRetryCount(sessionId);
      console.warn('Network error occurred, keeping recovery state for retry');
      return false;
    }
  };

  const incrementRetryCount = (sessionId: string) => {
    const currentState = localStorage.getItem(STREAMING_STATE_KEY);
    if (currentState) {
      try {
        const state: StreamingState = JSON.parse(currentState);
        if (state.sessionId === sessionId) {
          const newRetryCount = (state.retryCount || 0) + 1;
          const updatedState = {
            ...state,
            retryCount: newRetryCount,
            timestamp: Date.now(), // 更新时间戳
          };
          localStorage.setItem(STREAMING_STATE_KEY, JSON.stringify(updatedState));
          setRetryCount(newRetryCount);
        }
      } catch (error) {
        console.error('Failed to increment retry count:', error);
      }
    }
  };

  const dismissRecovery = () => {
    setShouldRecover(false);
    setRecoverySessionId(null);
    clearStreamingState();
  };

  const hideRecoveryBanner = () => {
    setShouldRecover(false);
  };

  return {
    shouldRecover,
    recoverySessionId,
    retryCount,
    saveStreamingState,
    clearStreamingState,
    saveCurrentSession,
    getCurrentSession,
    recoverStream,
    dismissRecovery,
    hideRecoveryBanner,
  };
};