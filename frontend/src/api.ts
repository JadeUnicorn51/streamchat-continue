import axios from 'axios';
import { ChatSession, Message } from './types';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
});

export const sessionApi = {
  create: (title?: string) => 
    api.post<ChatSession>('/sessions/', { title }),
  
  get: (sessionId: string) => 
    api.get<ChatSession>(`/sessions/${sessionId}`),
  
  getMessages: (sessionId: string) => 
    api.get<Message[]>(`/sessions/${sessionId}/messages`),
  
  getAll: () => 
    api.get<ChatSession[]>('/sessions/'),
};

export const chatApi = {
  startCompletion: (sessionId: string, content: string) =>
    fetch(`${API_BASE}/chat/${sessionId}/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    }),
  
  continueCompletion: (sessionId: string) =>
    fetch(`${API_BASE}/chat/${sessionId}/completions-continue`, {
      method: 'POST',
    }),
};