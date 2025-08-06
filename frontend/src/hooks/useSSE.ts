import { useState, useRef, useCallback } from 'react';
import { SSEData } from '../types';

interface UseSSEReturn {
  isStreaming: boolean;
  error: string | null;
  startStream: (response: Response, onData: (data: SSEData) => void) => void;
  stopStream: () => void;
}

export const useSSE = (): UseSSEReturn => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((response: Response, onData: (data: SSEData) => void) => {
    if (!response.body) {
      setError('No response body');
      return;
    }

    setIsStreaming(true);
    setError(null);

    const reader = response.body.getReader();
    readerRef.current = reader;

    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            setIsStreaming(false);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onData(data);
                
                if (data.type === 'done' || data.type === 'error') {
                  setIsStreaming(false);
                  return;
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } catch (streamError) {
        if (streamError.name !== 'AbortError') {
          setError(streamError.message);
        }
        setIsStreaming(false);
      }
    };

    processStream();
  }, []);

  return {
    isStreaming,
    error,
    startStream,
    stopStream,
  };
};