/**
 * ===============================================
 * SSE EVENT STREAM ROUTES
 * ===============================================
 * @file server/routes/events.ts
 *
 * Server-Sent Events endpoint for real-time updates.
 * Clients connect to /api/events/stream and receive
 * events for messages, notifications, and typing indicators.
 */

import express from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { sseManager } from '../services/sse-manager.js';

const router = express.Router();

// ============================================
// SSE STREAM ENDPOINT
// ============================================

/**
 * GET /api/events/stream
 * Establishes an SSE connection for the authenticated user.
 */
router.get(
  '/stream',
  authenticateToken,
  (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Flush headers immediately
    res.flushHeaders();

    // Register this connection
    const clientId = sseManager.addClient(
      res,
      user.id,
      user.email,
      user.type as 'admin' | 'client'
    );

    // Send initial connection confirmation
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    // Clean up on disconnect
    req.on('close', () => {
      sseManager.removeClient(clientId);
    });
  }
);

// ============================================
// TYPING INDICATOR ENDPOINT
// ============================================

/**
 * POST /api/events/typing
 * Broadcasts typing status to other participants in a thread.
 */
router.post(
  '/typing',
  authenticateToken,
  (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { threadId, isTyping } = req.body;

    if (!threadId || typeof isTyping !== 'boolean') {
      res.status(400).json({ error: 'threadId and isTyping required' });
      return;
    }

    // Broadcast typing event to admins (if sender is client) or
    // to the thread's client (if sender is admin)
    const event = {
      type: 'typing',
      data: {
        threadId,
        isTyping,
        senderName: user.email,
        senderType: user.type
      }
    };

    if (user.type === 'client') {
      // Client is typing — notify admins
      sseManager.sendToAdmins(event);
    } else {
      // Admin is typing — would need thread's client_id
      // For now, broadcast to all non-admin connections
      // (the client filters by threadId)
      sseManager.broadcast(event);
    }

    res.json({ ok: true });
  }
);

export { router as eventsRouter };
export default router;
