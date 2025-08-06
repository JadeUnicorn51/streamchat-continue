import React, { useState, useEffect, useRef } from 'react';
import { ChatSession, Message, SSEData } from '../types';
import { sessionApi, chatApi } from '../api';
import { useSSE } from '../hooks/useSSE';
import { useSessionRecovery } from '../hooks/useSessionRecovery';

interface ChatInterfaceProps {
  sessionId?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId }) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<string>('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const { isStreaming, startStream, stopStream } = useSSE();
  const { 
    shouldRecover, 
    recoverySessionId, 
    saveStreamingState, 
    clearStreamingState,
    recoverStream,
    dismissRecovery 
  } = useSessionRecovery();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, currentStreamingMessage]);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    // 页面卸载时保存流式状态
    const handleBeforeUnload = () => {
      if (isStreaming && sessionId && streamingMessageId) {
        saveStreamingState(sessionId, true, streamingMessageId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isStreaming, sessionId, streamingMessageId, saveStreamingState]);

  const loadSession = async (id: string) => {
    try {
      const [sessionRes, messagesRes] = await Promise.all([
        sessionApi.get(id),
        sessionApi.getMessages(id)
      ]);
      setSession(sessionRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleSSEData = (data: SSEData) => {
    switch (data.type) {
      case 'content':
        setCurrentStreamingMessage(data.accumulated || '');
        setStreamingMessageId(data.message_id);
        break;
      
      case 'resume':
        setCurrentStreamingMessage(data.existing_content || '');
        setStreamingMessageId(data.message_id);
        break;
      
      case 'retry':
        // 显示重试状态
        console.log(`重试中: ${data.message} (尝试 ${data.attempt})`);
        // 可以在这里添加UI提示重试状态
        break;
      
      case 'done':
        // 流式完成，添加到消息列表
        const newMessage: Message = {
          id: data.message_id,
          session_id: sessionId!,
          role: 'assistant',
          content: data.total_content || currentStreamingMessage,
          is_streaming: false,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, newMessage]);
        setCurrentStreamingMessage('');
        setStreamingMessageId(null);
        clearStreamingState();
        break;
      
      case 'error':
        console.error('Stream error:', data.error);
        // 如果有部分内容，保存它
        if (data.partial_content) {
          const errorMessage: Message = {
            id: data.message_id,
            session_id: sessionId!,
            role: 'assistant',
            content: data.partial_content + '\n\n[发生错误，回复可能不完整]',
            is_streaming: false,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        setCurrentStreamingMessage('');
        setStreamingMessageId(null);
        clearStreamingState();
        break;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      session_id: sessionId,
      role: 'user',
      content: input,
      is_streaming: false,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    setInput('');

    try {
      const response = await chatApi.startCompletion(sessionId, messageContent);
      if (response.ok) {
        saveStreamingState(sessionId, true);
        startStream(response, handleSSEData);
      }
    } catch (error) {
      console.error('Failed to start completion:', error);
    }
  };

  const handleRecoverStream = async () => {
    if (!recoverySessionId) return;
    
    const success = await recoverStream(recoverySessionId, handleSSEData);
    if (success) {
      if (sessionId !== recoverySessionId) {
        // 切换到恢复的会话
        loadSession(recoverySessionId);
      }
    }
    dismissRecovery();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!session) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="chat-interface">
      {shouldRecover && (
        <div className="recovery-banner">
          <p>检测到中断的对话，是否要恢复？</p>
          <button onClick={handleRecoverStream}>恢复对话</button>
          <button onClick={dismissRecovery}>忽略</button>
        </div>
      )}
      
      <div className="chat-header">
        <h2>{session.title || `会话 ${session.id.slice(0, 8)}`}</h2>
        {isStreaming && <span className="streaming-indicator">●</span>}
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
        
        {currentStreamingMessage && (
          <div className="message assistant streaming">
            <div className="message-content">
              {currentStreamingMessage}
              <span className="cursor">|</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          disabled={isStreaming}
          rows={3}
        />
        <button 
          onClick={sendMessage} 
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? '发送中...' : '发送'}
        </button>
        {isStreaming && (
          <button onClick={stopStream} className="stop-button">
            停止
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;