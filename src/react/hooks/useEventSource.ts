/**
 * ===============================================
 * SSE EVENT SOURCE HOOK
 * ===============================================
 * @file src/react/hooks/useEventSource.ts
 *
 * Connects to the SSE stream for real-time updates.
 * Provides event listeners for messages, notifications,
 * and typing indicators.
 *
 * Auto-reconnects on disconnect with exponential backoff.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { TIMING } from '@/constants/timing';

// ============================================
// CONSTANTS
// ============================================

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

// ============================================
// TYPES
// ============================================

export interface SSEEventHandlers {
  onNewMessage?: (data: { threadId: number; message: Record<string, unknown>; senderType: string }) => void;
  onTyping?: (data: { threadId: number; isTyping: boolean; senderName: string; senderType: string }) => void;
  onNotification?: (data: Record<string, unknown>) => void;
  onReadReceipt?: (data: { threadId: number; userId: number; readAt: string }) => void;
}

// ============================================
// HOOK
// ============================================

export function useEventSource(handlers: SSEEventHandlers) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current without reconnecting
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    // Don't connect in development (SSE uses polling in dev)
    if (typeof window === 'undefined') return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(API_ENDPOINTS.EVENTS_STREAM, {
      withCredentials: true
    });

    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
    });

    es.addEventListener('message:new', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onNewMessage?.(data);
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener('typing', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onTyping?.(data);
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onNotification?.(data);
      } catch {
        // Invalid JSON
      }
    });

    es.addEventListener('read:receipt', (e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current.onReadReceipt?.(data);
      } catch {
        // Invalid JSON
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_RETRY_DELAY_MS);

      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [connect]);

  return { connected };
}

// ============================================
// TYPING INDICATOR HELPER
// ============================================

/** Debounced typing indicator sender */
export function useSendTyping() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef(false);

  const sendTyping = useCallback((threadId: number, isTyping: boolean) => {
    // Don't send duplicate events
    if (lastSentRef.current === isTyping) return;
    lastSentRef.current = isTyping;

    // Clear pending stop timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    fetch(API_ENDPOINTS.EVENTS_TYPING, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, isTyping })
    }).catch(() => {
      // Ignore typing indicator failures
    });

    // Auto-stop typing after a delay
    if (isTyping) {
      timerRef.current = setTimeout(() => {
        lastSentRef.current = false;
        fetch(API_ENDPOINTS.EVENTS_TYPING, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, isTyping: false })
        }).catch(() => {});
      }, TIMING.SEARCH_DEBOUNCE * 10);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return sendTyping;
}
