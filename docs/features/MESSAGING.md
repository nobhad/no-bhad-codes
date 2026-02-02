# Messaging System Enhancement

**Status:** Complete
**Last Updated:** February 1, 2026

## Overview

The Messaging System provides professional-grade communication features including threads, mentions, reactions, read receipts, pinned messages, internal notes, and comprehensive search capabilities comparable to Slack, Microsoft Teams, and other industry leaders.

## Thread Status

Threads have the following status values:

| Status | Description |
|--------|-------------|
| `active` | Thread is open and accepting messages |
| `closed` | Thread has been closed (no new messages) |
| `archived` | Thread has been archived for historical reference |

## Features

### 1. Message Mentions

Track and notify users when mentioned in messages.

**Mention Types:**

| Type | Pattern | Description |
|------|---------|-------------|
| user | @email@domain.com | Mention specific user |
| team | @team_name | Mention a team (future) |
| all | @all | Mention all participants |

**Features:**

- Automatic mention parsing from message content
- Notification tracking (notified/not notified)
- Get all messages where user is mentioned
- Filter by unread mentions only

### 2. Message Reactions

Emoji and text reactions on messages.

**Features:**

- Add any emoji or text reaction
- One reaction per type per user (unique constraint)
- Automatic reaction count on messages
- Grouped reaction summary with user lists
- Check if current user has reacted

### 3. Message Subscriptions

Per-project notification preferences.

**Notification Options:**

| Option | Description |
|--------|-------------|
| notify_all | Receive all messages in project |
| notify_mentions | Only when mentioned |
| notify_replies | Only when someone replies to my message |

**Features:**

- Per-project subscription settings
- Temporary mute with optional end time
- Unmute functionality
- User type tracking (admin/client)

### 4. Read Receipts

Track message read status per user.

**Features:**

- Individual message read tracking
- Bulk mark as read
- Read receipt list per message (admin only)
- Unread count per user
- Unread count per thread

### 5. Pinned Messages

Pin important messages within threads.

**Features:**

- Pin/unpin messages (admin only)
- Get all pinned messages in thread
- Pinned count tracking on threads
- Pin metadata (who pinned, when)

### 6. Message Editing & Deletion

Edit or soft-delete messages.

**Features:**

- Edit message content
- Track edit timestamp
- Soft delete (preserves record)
- Track who deleted and when
- Permission checks (own messages or admin)

### 7. Internal Messages

Admin-only messages not visible to clients.

**Features:**

- Mark messages as internal
- Internal message indicator
- Separate internal message list
- Internal messages excluded from client view

### 8. Thread Archiving

Archive completed or old threads.

**Features:**

- Archive threads (admin only)
- Unarchive threads
- List archived threads
- Archive metadata (who archived, when)

### 9. Message Search

Search across all messages.

**Search Options:**

| Option | Description |
|--------|-------------|
| project_id | Limit to specific project |
| thread_id | Limit to specific thread |
| limit | Max results (default 50) |
| include_internal | Include internal messages (admin) |

**Features:**

- Full-text search in message content
- Thread subject in results
- Sender information
- Date filtering

## Database Schema

### New Tables

```sql
-- Message mentions
CREATE TABLE IF NOT EXISTS message_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  mentioned_type TEXT NOT NULL,    -- 'user', 'team', 'all'
  mentioned_id TEXT,               -- User email or team name
  notified BOOLEAN DEFAULT FALSE,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email, reaction)
);

-- Message subscriptions
CREATE TABLE IF NOT EXISTS message_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  notify_all BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_replies BOOLEAN DEFAULT TRUE,
  muted_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_email)
);

-- Read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email)
);

-- Pinned messages
CREATE TABLE IF NOT EXISTS pinned_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(thread_id, message_id)
);
```

### general_messages Table Additions

```sql
ALTER TABLE general_messages ADD COLUMN parent_message_id INTEGER REFERENCES general_messages(id);
ALTER TABLE general_messages ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;
ALTER TABLE general_messages ADD COLUMN edited_at DATETIME;
ALTER TABLE general_messages ADD COLUMN deleted_at DATETIME;
ALTER TABLE general_messages ADD COLUMN deleted_by TEXT;
ALTER TABLE general_messages ADD COLUMN reaction_count INTEGER DEFAULT 0;
ALTER TABLE general_messages ADD COLUMN reply_count INTEGER DEFAULT 0;
ALTER TABLE general_messages ADD COLUMN mention_count INTEGER DEFAULT 0;
```

### message_threads Table Additions

```sql
ALTER TABLE message_threads ADD COLUMN pinned_count INTEGER DEFAULT 0;
ALTER TABLE message_threads ADD COLUMN participant_count INTEGER DEFAULT 1;
ALTER TABLE message_threads ADD COLUMN archived_at DATETIME;
ALTER TABLE message_threads ADD COLUMN archived_by TEXT;
```

## API Endpoints

### Mentions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/messages/:messageId/mentions` | Get mentions in a message |
| GET | `/api/messages/mentions/me` | Get my mentions |

### Reactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/messages/:messageId/reactions` | Get reactions |
| POST | `/api/messages/messages/:messageId/reactions` | Add reaction |
| DELETE | `/api/messages/messages/:messageId/reactions/:reaction` | Remove reaction |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/projects/:projectId/subscription` | Get subscription |
| PUT | `/api/messages/projects/:projectId/subscription` | Update subscription |
| POST | `/api/messages/projects/:projectId/mute` | Mute project |
| POST | `/api/messages/projects/:projectId/unmute` | Unmute project |

### Read Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/messages/:messageId/read` | Mark as read |
| POST | `/api/messages/messages/read-bulk` | Bulk mark as read |
| GET | `/api/messages/messages/:messageId/read-receipts` | Get receipts (admin) |
| GET | `/api/messages/unread-count` | Get unread count |
| GET | `/api/messages/threads/:threadId/unread-count` | Get thread unread count |

### Pinned Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/threads/:threadId/pinned` | Get pinned messages |
| POST | `/api/messages/messages/:messageId/pin` | Pin message (admin) |
| DELETE | `/api/messages/messages/:messageId/pin` | Unpin message (admin) |

### Message Editing/Deletion

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/messages/messages/:messageId` | Edit message |
| DELETE | `/api/messages/messages/:messageId` | Delete message |

### Thread Archiving

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/threads/:threadId/archive` | Archive thread (admin) |
| POST | `/api/messages/threads/:threadId/unarchive` | Unarchive thread (admin) |
| GET | `/api/messages/threads/archived` | Get archived threads (admin) |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/search` | Search messages |

### Internal Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/threads/:threadId/internal` | Send internal message (admin) |
| GET | `/api/messages/threads/:threadId/internal` | Get internal messages (admin) |

## Service Methods

The `message-service.ts` provides the following methods:

### Mention Methods

- `processMentions(messageId, content)` - Parse and save mentions
- `getMentions(messageId)` - Get message mentions
- `getMyMentions(userEmail, unreadOnly)` - Get user's mentions

### Reaction Methods

- `addReaction(messageId, userEmail, userType, reaction)` - Add reaction
- `removeReaction(messageId, userEmail, reaction)` - Remove reaction
- `getReactions(messageId)` - Get message reactions
- `getGroupedReactions(messageId, currentUserEmail)` - Get grouped summary

### Subscription Methods

- `getSubscription(projectId, userEmail)` - Get subscription
- `updateSubscription(projectId, userEmail, prefs)` - Update
- `muteProject(projectId, userEmail, userType, until)` - Mute
- `unmuteProject(projectId, userEmail)` - Unmute

### Read Receipt Methods

- `markAsRead(messageId, userEmail, userType)` - Mark read
- `markMultipleAsRead(messageIds, userEmail, userType)` - Bulk mark
- `getReadReceipts(messageId)` - Get receipts
- `getUnreadCount(userEmail, userType)` - Get unread count
- `getThreadUnreadCount(threadId, userEmail)` - Get thread unread

### Pinned Message Methods

- `pinMessage(threadId, messageId, pinnedBy)` - Pin message
- `unpinMessage(threadId, messageId)` - Unpin message
- `getPinnedMessages(threadId)` - Get pinned messages

### Message Edit/Delete Methods

- `editMessage(messageId, content, userEmail, userType)` - Edit
- `deleteMessage(messageId, userEmail, userType)` - Delete

### Thread Archive Methods

- `archiveThread(threadId, archivedBy)` - Archive
- `unarchiveThread(threadId)` - Unarchive
- `getArchivedThreads()` - Get archived threads

### Search Methods

- `searchMessages(query, options)` - Search messages

## Usage Examples

### Add Reaction

```typescript
await fetch('/api/messages/messages/123/reactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reaction: '👍'
  })
});
```

### Update Subscription

```typescript
await fetch('/api/messages/projects/456/subscription', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notify_all: false,
    notify_mentions: true,
    notify_replies: true
  })
});
```

### Mute Project for 24 Hours

```typescript
const muteUntil = new Date();
muteUntil.setHours(muteUntil.getHours() + 24);

await fetch('/api/messages/projects/456/mute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    until: muteUntil.toISOString()
  })
});
```

### Search Messages

```typescript
const response = await fetch(
  '/api/messages/search?q=invoice&project_id=456&limit=20'
);
const { results, count } = await response.json();
```

### Pin a Message

```typescript
await fetch('/api/messages/messages/789/pin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    thread_id: 123
  })
});
```

## Files

### Created

- `server/database/migrations/034_messaging_enhancements.sql` - Database migration
- `server/services/message-service.ts` - Message service
- `docs/features/MESSAGING.md` - This documentation

### Modified

- `server/routes/messages.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

## Change Log

### February 1, 2026 - Initial Implementation

- Created database migration for messaging enhancement tables
- Implemented message-service.ts with all methods
- Added 25+ API endpoints to messages.ts
- Added TypeScript interfaces for all types
- Created feature documentation
