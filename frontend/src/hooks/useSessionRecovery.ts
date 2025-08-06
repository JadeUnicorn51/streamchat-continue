import { useState, useEffect } from 'react';
import { chatApi } from '../api';
import { useSSE } from './useSSE';
import { SSEData } from '../types';

const SESSION_STORAGE_KEY = 'streamchat_session_id';
const STREAMING_STATE_KEY = 'streamchat_streaming_state';

interface StreamingState {
  sessionId: string;
  isStreaming: boolean;
  lastMessageId?: string;
}

export const useSessionRecovery = () => {
  const [shouldRecover, setShouldRecover] = useState(false);
  const [recoverySessionId, setRecoverySessionId] = useState<string | null>(null);
  const { startStream } = useSSE();

  useEffect(() => {
    // 检查页面加载时是否有中断的流式对话
    const savedState = localStorage.getItem(STREAMING_STATE_KEY);
    if (savedState) {
      try {
        const state: StreamingState = JSON.parse(savedState);
        if (state.isStreaming && state.sessionId) {
          setShouldRecover(true);
          setRecoverySessionId(state.sessionId);
        }
      } catch (error) {
        console.error('Failed to parse streaming state:', error);
        localStorage.removeItem(STREAMING_STATE_KEY);
      }
    }
  }, []);

  const saveStreamingState = (sessionId: string, isStreaming: boolean, messageId?: string) => {
    const state: StreamingState = {
      sessionId,
      isStreaming,
      lastMessageId: messageId,
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
          
          if (data.type === 'done' || data.type === 'error') {
            clearStreamingState();
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to recover stream:', error);
      clearStreamingState();
      return false;
    }
  };

  const dismissRecovery = () => {
    setShouldRecover(false);
    setRecoverySessionId(null);
    clearStreamingState();
  };

  return {
    shouldRecover,
    recoverySessionId,
    saveStreamingState,
    clearStreamingState,
    saveCurrentSession,
    getCurrentSession,
    recoverStream,
    dismissRecovery,
  };
};