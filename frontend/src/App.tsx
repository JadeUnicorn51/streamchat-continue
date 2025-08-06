import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';
import { ChatSession } from './types';
import { sessionApi } from './api';
import { useSessionRecovery } from './hooks/useSessionRecovery';

function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { getCurrentSession, saveCurrentSession } = useSessionRecovery();

  useEffect(() => {
    loadSessions();
    
    // 尝试恢复上次的会话
    const lastSessionId = getCurrentSession();
    if (lastSessionId) {
      setCurrentSessionId(lastSessionId);
    }
  }, []);

  const loadSessions = async () => {
    try {
      const response = await sessionApi.getAll();
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await sessionApi.create('新对话');
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      saveCurrentSession(newSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    saveCurrentSession(sessionId);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <button className="new-chat-btn" onClick={createNewSession}>
          + 新对话
        </button>
        
        <div className="sessions-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
              onClick={() => selectSession(session.id)}
            >
              <div className="session-title">
                {session.title || `会话 ${session.id.slice(0, 8)}`}
              </div>
              <div className="session-status">
                <span className={`status-indicator ${session.status}`}></span>
                {session.status === 'active' && '进行中'}
                {session.status === 'completed' && '已完成'}
                {session.status === 'interrupted' && '已中断'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {currentSessionId ? (
          <ChatInterface sessionId={currentSessionId} />
        ) : (
          <div className="welcome">
            <h1>StreamChat Demo</h1>
            <p>支持流式对话和会话恢复的聊天应用</p>
            <button onClick={createNewSession}>开始新对话</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App
