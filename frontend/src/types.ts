export interface ChatSession {
  id: string;
  title: string | null;
  status: 'active' | 'completed' | 'interrupted';
  created_at: string;
  updated_at: string;
  last_message_id: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  is_streaming: boolean;
  created_at: string;
}

export interface SSEData {
  type: 'content' | 'done' | 'error' | 'resume' | 'retry';
  content?: string;
  message_id: string;
  accumulated?: string;
  existing_content?: string;
  total_content?: string;
  error?: string;
  message?: string;
  attempt?: number;
  partial_content?: string;
}