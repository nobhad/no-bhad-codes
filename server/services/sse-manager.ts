/**
 * ===============================================
 * SSE CONNECTION MANAGER
 * ===============================================
 * @file server/services/sse-manager.ts
 *
 * Manages Server-Sent Event connections for real-time
 * updates to connected portal clients.
 *
 * Tracks connections by user (email + type) and provides
 * methods to broadcast events to specific users or all.
 */

import type { Response } from 'express';
import { logger } from './logger.js';

// ============================================
// CONSTANTS
// ============================================

/** Heartbeat interval to keep connections alive (ms) */
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Max connections per user to prevent resource exhaustion */
const MAX_CONNECTIONS_PER_USER = 3;

// ============================================
// TYPES
// ============================================

export interface SSEClient {
  id: string;
  res: Response;
  userEmail: string;
  userType: 'admin' | 'client';
  userId: number;
  connectedAt: Date;
}

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

// ============================================
// SSE MANAGER
// ============================================

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionCounter = 0;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Add a new SSE client connection
   */
  addClient(res: Response, userId: number, userEmail: string, userType: 'admin' | 'client'): string {
    const clientId = `${userType}-${userId}-${++this.connectionCounter}`;

    // Enforce per-user connection limit
    const userConnections = this.getClientsForUser(userId, userType);
    if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
      // Close oldest connection
      const oldest = userConnections[0];
      this.removeClient(oldest.id);
    }

    const client: SSEClient = {
      id: clientId,
      res,
      userEmail,
      userType,
      userId,
      connectedAt: new Date()
    };

    this.clients.set(clientId, client);

    logger.info('SSE client connected', {
      category: 'sse',
      metadata: { clientId, userType, userId, total: this.clients.size }
    });

    return clientId;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      try {
        client.res.end();
      } catch {
        // Connection already closed
      }
      logger.info('SSE client disconnected', {
        category: 'sse',
        metadata: { clientId, total: this.clients.size }
      });
    }
  }

  /**
   * Send event to a specific user (all their connections)
   */
  sendToUser(userId: number, userType: 'admin' | 'client', event: SSEEvent): void {
    const clients = this.getClientsForUser(userId, userType);
    for (const client of clients) {
      this.sendEvent(client, event);
    }
  }

  /**
   * Send event to all admin connections
   */
  sendToAdmins(event: SSEEvent): void {
    for (const client of this.clients.values()) {
      if (client.userType === 'admin') {
        this.sendEvent(client, event);
      }
    }
  }

  /**
   * Send event to all connected clients
   */
  broadcast(event: SSEEvent): void {
    for (const client of this.clients.values()) {
      this.sendEvent(client, event);
    }
  }

  /**
   * Send event to all users associated with a thread
   * (useful for typing indicators, read receipts)
   */
  sendToThread(threadParticipants: Array<{ userId: number; userType: 'admin' | 'client' }>, event: SSEEvent, excludeUserId?: number): void {
    for (const participant of threadParticipants) {
      if (excludeUserId && participant.userId === excludeUserId) continue;
      this.sendToUser(participant.userId, participant.userType, event);
    }
  }

  /**
   * Get current connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Cleanup all connections (for graceful shutdown)
   */
  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        // Ignore
      }
    }
    this.clients.clear();
  }

  // ============================================
  // PRIVATE
  // ============================================

  private getClientsForUser(userId: number, userType: string): SSEClient[] {
    const clients: SSEClient[] = [];
    for (const client of this.clients.values()) {
      if (client.userId === userId && client.userType === userType) {
        clients.push(client);
      }
    }
    return clients;
  }

  private sendEvent(client: SSEClient, event: SSEEvent): void {
    try {
      const data = JSON.stringify(event.data);
      client.res.write(`event: ${event.type}\ndata: ${data}\n\n`);
    } catch {
      // Connection broken, remove client
      this.removeClient(client.id);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        try {
          client.res.write(':heartbeat\n\n');
        } catch {
          this.removeClient(client.id);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const sseManager = new SSEManager();
