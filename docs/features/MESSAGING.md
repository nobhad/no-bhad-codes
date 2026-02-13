# Messaging System

**Status:** Complete
**Last Updated:** February 3, 2026

## Table of Contents

1. [Overview](#overview)
2. [Features Summary](#features-summary)
3. [UI Implementation](#ui-implementation)
4. [Backend Features](#backend-features)
5. [TypeScript Implementation](#typescript-implementation)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Admin Messaging](#admin-messaging)
9. [File Locations](#file-locations)
10. [Change Log](#change-log)

---

## Overview

The messaging system provides real-time communication between clients and developers within the Client Portal. It includes professional-grade features comparable to Slack and Microsoft Teams: threads, mentions, reactions, read receipts, pinned messages, internal notes, and comprehensive search.

**Access:** Client Portal > Messages tab (`tab-messages`)

---

## Features Summary

### Client-Facing Features

| Feature | Description |
|---------|-------------|
| Thread View | Chronological message display |
| File Attachments | Upload up to 5 files per message (10MB each) |
| Emoji Picker | Native emoji keyboard via `emoji-picker-element` (desktop only) |
| Enter to Send | Quick message sending with keyboard |
| Shift+Enter | Insert newline without sending |
| Sender Identification | Visual distinction between sent/received |
| Timestamps | Date and time for each message |
| Avatar Display | Profile images for sender identification |
| Click-outside Close | Emoji picker closes when clicking outside |
| Demo Mode Messaging | Users can send messages in demo mode (resets on refresh) |
| Mobile Responsive | Optimized layout for mobile devices |

### Backend Features

| Feature | Description |
|---------|-------------|
| Message Mentions | @user, @team, @all notifications |
| Message Reactions | Emoji reactions with counts |
| Subscriptions | Per-project notification preferences |
| Read Receipts | Track message read status per user |
| Pinned Messages | Pin important messages within threads |
| Message Editing | Edit message content with timestamp tracking |
| Soft Delete | Delete messages while preserving records |
| Internal Messages | Admin-only messages not visible to clients |
| Thread Archiving | Archive completed threads |
| Message Search | Full-text search across all messages |

### Thread Status Values

| Status | Description |
|--------|-------------|
| `active` | Thread is open and accepting messages |
| `closed` | Thread has been closed (no new messages) |
| `archived` | Thread has been archived for historical reference |

---

## UI Implementation

### HTML Structure

#### Complete Messages Tab

```html
<!-- templates/pages/client-portal.ejs:128-181 -->
<div class="tab-content" id="tab-messages">
    <div class="page-header">
        <h2>Messages</h2>
    </div>

    <!-- Messages Thread -->
    <div class="messages-container cp-shadow">
        <div class="messages-thread" id="messages-thread">
            <!-- Message items rendered here -->
        </div>

        <!-- Compose Message -->
        <div class="message-compose">
            <div class="message-input-wrapper">
                <textarea id="message-input" class="form-textarea"
                          placeholder="Type your message..."></textarea>
                <button type="button" class="emoji-toggle-btn" id="emoji-toggle"
                        aria-label="Open emoji picker">
                    <!-- Smiley face SVG icon -->
                </button>
            </div>
            <div class="emoji-picker-wrapper hidden" id="emoji-picker-wrapper">
                <emoji-picker id="emoji-picker"></emoji-picker>
            </div>
            <button class="btn btn-secondary" id="btn-send-message">Send Message</button>
        </div>
    </div>
</div>
```

### Message Components

#### Received Message Structure

```html
<div class="message message-received">
    <div class="message-avatar">
        <img src="/images/avatar.svg" alt="Noelle" class="avatar-img">
    </div>
    <div class="message-content">
        <div class="message-header">
            <span class="message-sender">Noelle</span>
            <span class="message-time">Nov 30, 2025 at 10:30 AM</span>
        </div>
        <div class="message-body">
            Welcome to your project portal!
        </div>
    </div>
</div>
```

#### Sent Message Structure

```html
<div class="message message-sent">
    <div class="message-content">
        <div class="message-header">
            <span class="message-sender">You</span>
            <span class="message-time">Nov 30, 2025 at 11:15 AM</span>
        </div>
        <div class="message-body">
            Thanks! Looking forward to seeing the initial designs.
        </div>
    </div>
    <div class="message-avatar">
        <div class="avatar-placeholder">YOU</div>
    </div>
</div>
```

### Emoji Picker

**Package:** `emoji-picker-element` (vanilla JS/TS web component)

```typescript
// src/features/client/client-portal.ts:15
import 'emoji-picker-element';
```

#### Event Handling

```typescript
const emojiPicker = document.querySelector('emoji-picker');
if (emojiPicker && messageInput) {
  emojiPicker.addEventListener('emoji-click', ((e: CustomEvent) => {
    const emoji = e.detail?.unicode;
    if (emoji) {
      const start = messageInput.selectionStart;
      const end = messageInput.selectionEnd;
      const text = messageInput.value;
      messageInput.value = text.substring(0, start) + emoji + text.substring(end);
      messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
      messageInput.focus();
    }
  }) as EventListener);
}
```

#### CSS Theming

```css
.emoji-picker-wrapper emoji-picker {
  width: 100%;
  max-width: 400px;
  --background: var(--color-neutral-100);
  --border-color: #000000;
  --indicator-color: var(--color-primary);
  --input-border-color: var(--color-dark);
  --button-active-background: var(--color-primary);
  --button-hover-background: var(--color-neutral-200);
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Tab` | Move focus from textarea to send button |

### Mobile Responsiveness

On mobile devices (< 768px):

- Emoji picker hidden (difficult on touch)
- Chat container takes most of screen height
- Messages thread scrollable within container
- Send button always visible
- Message bubbles extend to edges
- Avatar positioning optimized for touch

```css
@media (max-width: 768px) {
  .emoji-picker-container {
    display: none !important;
  }

  .messages-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 100px);
  }

  .messages-thread {
    flex: 1;
    min-height: 0;
    max-height: none;
    overflow-y: auto;
  }
}
```

### Styling

#### Messages Container

```css
.messages-container {
  background: var(--color-neutral-300);
  border: 4px solid #000000;
  padding: 1.5rem;
}

.messages-thread {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
}
```

#### Message Layout

```css
.message {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.message-received { flex-direction: row; }
.message-sent { flex-direction: row-reverse; }

.message-content {
  max-width: 70%;
  padding: 1rem;
}

.message-received .message-content {
  background: var(--color-neutral-100);
  border-radius: 0 12px 12px 12px;
}

.message-sent .message-content {
  background: var(--color-primary);
  color: var(--color-dark);
  border-radius: 12px 0 12px 12px;
}
```

#### Avatar Styles

```css
.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-neutral-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
}
```

---

## Backend Features

### File Attachments

Messages support file attachments with the following specifications:

**Limits:**

- Maximum 5 files per message
- Maximum 10MB per file
- Allowed types: pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, zip

**Implementation:**

- Upload via `multer` middleware (multipart/form-data)
- Files stored in `uploads/messages/` directory
- Attachments stored as JSON array in `attachments` column
- Download endpoint: `GET /api/messages/attachments/:filename/download`

**Attachment Object Structure:**

```typescript
interface MessageAttachment {
  filename: string;      // Stored filename (UUID-based)
  original: string;      // Original filename
  size: number;          // File size in bytes
  mimetype: string;      // MIME type
}
```

**Frontend Integration:**

- Paperclip button in message composer
- File chips showing attached files before send
- Attachment previews in message bubbles
- Click to download attachment

---

### 1. Message Mentions

Track and notify users when mentioned in messages.

**Mention Types:**

| Type | Pattern | Description |
|------|---------|-------------|
| user | @<<email@domain.com>> | Mention specific user |
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

| Option | Description |
|--------|-------------|
| project_id | Limit to specific project |
| thread_id | Limit to specific thread |
| limit | Max results (default 50) |
| include_internal | Include internal messages (admin) |

---

## TypeScript Implementation

### API Base URL

```typescript
const MESSAGES_API_BASE = '/api/messages';
```

### Message Data Interface

```typescript
interface PortalMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name: string;
  sender_type: 'client' | 'admin' | 'system';
  message: string;
  created_at: string;
  read_at: string | null;
}
```

### Loading Messages from API

```typescript
export async function loadMessagesFromAPI(ctx: ClientPortalContext): Promise<void> {
  const messagesContainer = document.getElementById('messages-thread');
  if (!messagesContainer) return;

  if (ctx.isDemo()) {
    renderDemoMessages(messagesContainer, ctx);
    return;
  }

  try {
    const threadsResponse = await fetch(`${MESSAGES_API_BASE}/threads`, {
      credentials: 'include'
    });

    if (!threadsResponse.ok) {
      throw new Error('Failed to load message threads');
    }

    const threadsData = await threadsResponse.json();
    const threads = threadsData.threads || [];

    if (threads.length === 0) {
      messagesContainer.innerHTML = `
        <div class="no-messages">
          <p>No messages yet. Start a conversation!</p>
        </div>
      `;
      return;
    }

    const thread = threads[0];
    currentThreadId = thread.id;

    const messagesResponse = await fetch(
      `${MESSAGES_API_BASE}/threads/${thread.id}/messages`,
      { credentials: 'include' }
    );

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesData = await messagesResponse.json();
    renderMessages(messagesContainer, messagesData.messages || [], ctx);

    await fetch(`${MESSAGES_API_BASE}/threads/${thread.id}/read`, {
      method: 'PUT',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Error loading messages:', error);
    renderDemoMessages(messagesContainer, ctx);
  }
}
```

### Sending Messages

```typescript
export async function sendMessage(ctx: ClientPortalContext): Promise<void> {
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  if (ctx.isDemo()) {
    addDemoMessage(message, ctx);
    messageInput.value = '';
    return;
  }

  try {
    let url: string;
    let body: { message: string; subject?: string };

    if (currentThreadId) {
      url = `${MESSAGES_API_BASE}/threads/${currentThreadId}/messages`;
      body = { message };
    } else {
      url = `${MESSAGES_API_BASE}/inquiry`;
      body = { subject: 'General Inquiry', message };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();
    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    messageInput.value = '';
    await loadMessagesFromAPI(ctx);
  } catch (error) {
    console.error('Error sending message:', error);
    alert(error instanceof Error ? error.message : 'Failed to send message.');
  }
}
```

### Demo Mode Messages

```typescript
function addDemoMessage(message: string, ctx: ClientPortalContext): void {
  const messagesThread = document.getElementById('messages-thread');
  if (!messagesThread) return;

  const now = new Date();
  const timeString = `${now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })} at ${now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`;

  const messageHTML = `
    <div class="message message-sent">
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">You</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-body">${ctx.escapeHtml(message)}</div>
      </div>
      <div class="message-avatar" data-name="You">
        <div class="avatar-placeholder">YOU</div>
      </div>
    </div>
  `;

  messagesThread.insertAdjacentHTML('beforeend', messageHTML);
  messagesThread.scrollTop = messagesThread.scrollHeight;
}
```

---

## API Endpoints

### Core Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/threads` | Load message threads |
| POST | `/api/messages/threads` | Create new thread |
| GET | `/api/messages/threads/:id/messages` | Get messages in thread |
| POST | `/api/messages/threads/:id/messages` | Send message in thread |
| PUT | `/api/messages/threads/:id/read` | Mark thread messages as read |
| POST | `/api/messages/inquiry` | Create quick inquiry (creates thread + message) |
| GET | `/api/messages/preferences` | Get notification preferences |
| PUT | `/api/messages/preferences` | Update notification preferences |
| GET | `/api/messages/analytics` | Get message analytics (admin only) |

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

### Search & Internal

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/search` | Search messages |
| POST | `/api/messages/threads/:threadId/internal` | Send internal message (admin) |
| GET | `/api/messages/threads/:threadId/internal` | Get internal messages (admin) |

---

## Database Schema

### Core Tables

#### general_messages

```sql
CREATE TABLE general_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin', 'system')),
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'inquiry' CHECK (message_type IN ('inquiry', 'quote_request', 'support', 'feedback', 'system')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  reply_to INTEGER DEFAULT NULL REFERENCES general_messages(id) ON DELETE SET NULL,
  attachments TEXT DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME DEFAULT NULL,
  thread_id INTEGER DEFAULT NULL,
  parent_message_id INTEGER REFERENCES general_messages(id),
  is_internal BOOLEAN DEFAULT FALSE,
  edited_at DATETIME,
  deleted_at DATETIME,
  deleted_by TEXT,
  reaction_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE SET NULL
);
```

#### message_threads

```sql
CREATE TABLE message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER DEFAULT NULL,
  client_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  thread_type TEXT DEFAULT 'general' CHECK (thread_type IN ('general', 'project', 'support', 'quote')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_by TEXT DEFAULT NULL,
  participant_count INTEGER DEFAULT 2,
  pinned_count INTEGER DEFAULT 0,
  archived_at DATETIME,
  archived_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
```

### Enhancement Tables

#### message_mentions

```sql
CREATE TABLE IF NOT EXISTS message_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  mentioned_type TEXT NOT NULL,
  mentioned_id TEXT,
  notified BOOLEAN DEFAULT FALSE,
  notified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE
);
```

#### message_reactions

```sql
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
```

#### message_subscriptions

```sql
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
```

#### message_read_receipts

```sql
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES general_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_email)
);
```

#### pinned_messages

```sql
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

---

## Admin Messaging

### Custom Client Dropdown

The admin Messages tab uses a custom dropdown for better styling control:

```html
<div class="custom-dropdown" id="admin-client-dropdown">
  <button class="custom-dropdown-trigger" id="admin-client-trigger">
    <span class="custom-dropdown-text">Select a client...</span>
    <span class="custom-dropdown-caret"></span>
  </button>
  <ul class="custom-dropdown-menu" id="admin-client-menu">
    <!-- Client items populated dynamically -->
  </ul>
</div>
```

### Unread Message Counts

```typescript
if (client.unread_count > 0) {
  const countSpan = document.createElement('span');
  countSpan.className = 'dropdown-item-count has-unread';
  countSpan.textContent = String(client.unread_count);
}
```

### Cache Busting

After sending a message, fetch with cache-busting:

```typescript
const url = bustCache
  ? `/api/messages/threads/${threadId}/messages?_=${Date.now()}`
  : `/api/messages/threads/${threadId}/messages`;
```

### Admin Avatar

```css
.messages-thread .message-avatar .avatar-img {
  filter: invert(1);
}
```

### Module Architecture

**Module** (`src/features/admin/modules/admin-messaging.ts`):

- State management for selected client/thread
- API calls for messaging operations

**Renderer** (`src/features/admin/renderers/admin-messaging.renderer.ts`):

- `renderThreadsList(threads)` - Renders thread list sidebar
- `renderMessages(messages)` - Renders messages in thread view
- `appendMessage(message)` - Optimistic UI update
- `clearMessageInput()` - Clears compose textarea
- `updateUnreadBadge(count)` - Updates sidebar badge

### Email Notifications

```typescript
await emailService.sendMessageNotification(clientEmail, {
  recipientName: 'John Doe',
  senderName: 'Admin',
  subject: 'New Message',
  message: messageContent,
  threadId: threadId,
  portalUrl: 'https://portal.nobhad.codes',
  hasAttachments: false
});
```

---

## File Locations

| File | Purpose |
|------|---------|
| `client/portal.html` | Messages HTML (tab-messages section) |
| `src/features/client/modules/portal-messages.ts` | Client message module (~270 lines) |
| `src/features/admin/modules/admin-messaging.ts` | Admin message module (~400 lines) |
| `src/features/admin/renderers/admin-messaging.renderer.ts` | Admin messaging UI renderer |
| `src/styles/client-portal/messages.css` | Client message styling |
| `src/styles/admin/project-detail.css` | Admin message styling |
| `server/routes/messages.ts` | API endpoints |
| `server/services/message-service.ts` | Message service (backend logic) |
| `server/services/email-service.ts` | Email notifications |
| `server/database/migrations/034_messaging_enhancements.sql` | Database migration |

---

## Change Log

### February 3, 2026 - Documentation Consolidation

- Merged MESSAGES.md (UI documentation) and MESSAGING.md (backend features) into single comprehensive document

### February 1, 2026 - Backend Enhancements

- Created database migration for messaging enhancement tables
- Implemented message-service.ts with all methods
- Added 25+ API endpoints to messages.ts
- Added TypeScript interfaces for all types

### January 20, 2026 - Initial UI Implementation

- Implemented client portal messaging UI
- Added emoji picker integration
- Added keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Implemented mobile responsiveness
- Added demo mode messaging

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Notification preferences
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
