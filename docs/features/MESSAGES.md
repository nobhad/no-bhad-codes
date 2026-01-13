# Messaging System

**Last Updated:** January 13, 2026

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [HTML Structure](#html-structure)
4. [Components](#components)
5. [Emoji Picker](#emoji-picker)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [TypeScript Implementation](#typescript-implementation)
8. [Backend Integration](#backend-integration)
9. [Mobile Responsiveness](#mobile-responsiveness)
10. [Styling](#styling)
11. [File Locations](#file-locations)

---

## Overview

The messaging system provides real-time communication between clients and developers within the Client Portal. Messages are displayed in a thread view with sender identification, timestamps, and avatar images.

**Access:** Client Portal > Messages tab (`tab-messages`)

---

## Features

| Feature | Description |
|---------|-------------|
| Thread View | Chronological message display |
| Emoji Picker | Native emoji keyboard via `emoji-picker-element` (desktop only) |
| Enter to Send | Quick message sending with keyboard |
| Shift+Enter | Insert newline without sending |
| Sender Identification | Visual distinction between sent/received |
| Timestamps | Date and time for each message |
| Avatar Display | Profile images for sender identification |
| Click-outside Close | Emoji picker closes when clicking outside |
| Demo Mode Messaging | Users can send messages in demo mode (resets on refresh) |
| Mobile Responsive | Optimized layout for mobile devices |

---

## HTML Structure

### Complete Messages Tab

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

---

## Components

### Message Thread Container

```html
<div class="messages-thread" id="messages-thread">
    <!-- Messages rendered dynamically -->
</div>
```

### Received Message Structure

```html
<!-- templates/pages/client-portal.ejs:137-150 -->
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
            Welcome to your project portal! I'm excited to work with you.
            I've reviewed your intake form and will begin the planning phase shortly.
        </div>
    </div>
</div>
```

### Sent Message Structure

```html
<!-- templates/pages/client-portal.ejs:151-164 -->
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

### Message Compose Area

```html
<!-- templates/pages/client-portal.ejs:167-179 -->
<div class="message-compose">
    <div class="message-input-wrapper">
        <textarea id="message-input" class="form-textarea"
                  placeholder="Type your message..."></textarea>
        <button type="button" class="emoji-toggle-btn" id="emoji-toggle"
                aria-label="Open emoji picker">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        </button>
    </div>
    <div class="emoji-picker-wrapper hidden" id="emoji-picker-wrapper">
        <emoji-picker id="emoji-picker"></emoji-picker>
    </div>
    <button class="btn btn-secondary" id="btn-send-message">Send Message</button>
</div>
```

---

## Emoji Picker

### Package

Uses `emoji-picker-element` web component (vanilla JS/TS alternative to React's `emoji-picker-react`).

**NPM Package:** `emoji-picker-element`

**Import in TypeScript:**

```typescript
// src/features/client/client-portal.ts:15
import 'emoji-picker-element';
```

### Web Component Usage

```html
<emoji-picker id="emoji-picker"></emoji-picker>
```

### Complete Event Handling

```typescript
// src/features/client/modules/portal-messages.ts
// Setup messaging event listeners including emoji picker
export function setupMessagingListeners(ctx: ClientPortalContext): void {
  const sendBtn = document.getElementById('btn-send-message');
  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage(ctx);
    });
  }

  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(ctx);
      }
    });
  }

  // Emoji picker integration
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
}
```

### Emoji Picker Event Details

| Event | Property | Type | Description |
|-------|----------|------|-------------|
| `emoji-click` | `detail.unicode` | `string` | The emoji character |
| `emoji-click` | `detail.emoji` | `object` | Full emoji data object |

### CSS Theming

The emoji picker uses CSS custom properties for theming:

```css
/* src/styles/pages/client-portal.css */
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

### Available CSS Variables

| Variable | Purpose |
|----------|---------|
| `--background` | Picker background color |
| `--border-color` | Picker border color |
| `--indicator-color` | Active category indicator |
| `--input-border-color` | Search input border |
| `--button-active-background` | Active button background |
| `--button-hover-background` | Hovered button background |
| `--category-font-size` | Category label font size |
| `--emoji-size` | Individual emoji size |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |

### Implementation

```typescript
// src/features/client/client-portal.ts:230-238
// Enter key to send message
if (messageInput && sendButton) {
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });
}
```

---

## TypeScript Implementation

### API Base URL

```typescript
const MESSAGES_API_BASE = '/api/messages';
```

### Loading Messages from API

```typescript
// src/features/client/modules/portal-messages.ts
export async function loadMessagesFromAPI(ctx: ClientPortalContext): Promise<void> {
  const messagesContainer = document.getElementById('messages-thread');
  if (!messagesContainer) return;

  // Demo mode check using context
  if (ctx.isDemo()) {
    renderDemoMessages(messagesContainer, ctx);
    return;
  }

  try {
    const threadsResponse = await fetch(`${MESSAGES_API_BASE}/threads`, {
      credentials: 'include' // HttpOnly cookie authentication
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

    // Get messages from first thread
    const thread = threads[0];
    currentThreadId = thread.id;

    const messagesResponse = await fetch(`${MESSAGES_API_BASE}/threads/${thread.id}/messages`, {
      credentials: 'include' // HttpOnly cookie authentication
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to load messages');
    }

    const messagesData = await messagesResponse.json();
    renderMessages(messagesContainer, messagesData.messages || [], ctx);

    // Mark thread as read
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

### Rendering Messages

```typescript
// src/features/client/modules/portal-messages.ts
function renderMessages(
  container: HTMLElement,
  messages: PortalMessage[],
  ctx: ClientPortalContext
): void {
  if (messages.length === 0) {
    container.innerHTML = '<div class="no-messages"><p>No messages in this thread yet.</p></div>';
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isSent = msg.sender_type === 'client';
      const initials = (msg.sender_name || 'Unknown').substring(0, 3).toUpperCase();
      return `
      <div class="message message-${isSent ? 'sent' : 'received'}">
        <div class="message-avatar">
          <div class="avatar-placeholder">${initials}</div>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${ctx.escapeHtml(msg.sender_name || 'Unknown')}</span>
            <span class="message-time">${ctx.formatDate(msg.created_at)}</span>
          </div>
          <div class="message-body">${ctx.escapeHtml(msg.message)}</div>
        </div>
      </div>
    `;
    })
    .join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}
```

### Sending Messages

```typescript
// src/features/client/modules/portal-messages.ts
export async function sendMessage(ctx: ClientPortalContext): Promise<void> {
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  // Demo mode: add message locally (resets on refresh)
  if (ctx.isDemo()) {
    addDemoMessage(message, ctx);
    messageInput.value = '';
    return;
  }

  try {
    let url: string;
    let body: { message: string; subject?: string };

    // If thread exists, send to thread; otherwise create via inquiry endpoint
    if (currentThreadId) {
      url = `${MESSAGES_API_BASE}/threads/${currentThreadId}/messages`;
      body = { message };
    } else {
      url = `${MESSAGES_API_BASE}/inquiry`;
      body = { subject: 'General Inquiry', message };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // HttpOnly cookie authentication
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const data = await response.json();

    // Store thread ID if new thread was created
    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    messageInput.value = '';
    await loadMessagesFromAPI(ctx);
  } catch (error) {
    console.error('Error sending message:', error);
    alert(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
  }
}
```

### Demo Messages Fallback

In demo mode, the static HTML messages from `portal.html` are preserved. If no static messages exist, a placeholder is shown:

```typescript
// src/features/client/modules/portal-messages.ts
function renderDemoMessages(container: HTMLElement, _ctx: ClientPortalContext): void {
  // In demo mode, keep the existing static HTML messages
  // Only render placeholder if container is empty
  if (container.children.length > 0) {
    return;
  }

  // Fallback if no static messages exist
  container.innerHTML = '<div class="no-messages"><p>No messages yet. Start a conversation!</p></div>';
}
```

### Message Data Interface

```typescript
// src/features/client/portal-types.ts
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

### Thread ID Tracking

The module tracks the current thread ID to avoid repeated lookups:

```typescript
// src/features/client/modules/portal-messages.ts
let currentThreadId: number | null = null;

export function getCurrentThreadId(): number | null {
  return currentThreadId;
}

export function setCurrentThreadId(id: number | null): void {
  currentThreadId = id;
}
```

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages/threads` | GET | Load message threads |
| `/api/messages/threads` | POST | Create new thread |
| `/api/messages/threads/:id/messages` | GET | Get messages in thread |
| `/api/messages/threads/:id/messages` | POST | Send message in thread |
| `/api/messages/threads/:id/read` | PUT | Mark thread messages as read |
| `/api/messages/inquiry` | POST | Create quick inquiry (creates thread + message) |
| `/api/messages/preferences` | GET | Get notification preferences |
| `/api/messages/preferences` | PUT | Update notification preferences |
| `/api/messages/analytics` | GET | Get message analytics (admin only) |

### Database Schema

**General Messages Table:**

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
  attachments TEXT DEFAULT NULL, -- JSON array of attachment file paths
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME DEFAULT NULL,
  thread_id INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE SET NULL
);
```

**Message Threads Table:**

```sql
CREATE TABLE message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER DEFAULT NULL, -- NULL for general threads
  client_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  thread_type TEXT DEFAULT 'general' CHECK (thread_type IN ('general', 'project', 'support', 'quote')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_by TEXT DEFAULT NULL,
  participant_count INTEGER DEFAULT 2,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
```

### Email Notifications

Messages trigger email notifications based on user preferences:

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

## Mobile Responsiveness

On mobile devices (screens under 768px), the messaging interface adapts for touch interaction:

### Mobile Layout Changes

- Emoji picker is hidden (difficult to use on mobile)
- Chat container takes most of screen height
- Messages thread is scrollable within container
- Send button always visible (mobile keyboards don't always have Enter)
- Message bubbles extend to edges of container
- Avatar positioning optimized for touch

### Demo Mode Messaging

In demo mode, users can send messages that display locally but reset on page refresh:

```typescript
// src/features/client/modules/portal-messages.ts
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

### Mobile CSS

```css
@media (max-width: 768px) {
  /* Hide emoji picker on mobile */
  .emoji-picker-container {
    display: none !important;
  }

  /* Chat takes most of screen height */
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
    padding: 0.5rem;
  }

  /* Message bubbles extend to edges */
  .message {
    max-width: 100%;
    width: 100%;
  }

  .message-received .message-content {
    border-radius: 0 12px 12px 12px;
  }

  .message-sent .message-content {
    border-radius: 12px 0 12px 12px;
  }
}
```

---

## Styling

### Messages Container

```css
.messages-container {
  background: var(--color-neutral-300);
  border: 4px solid #000000;
  padding: 1.5rem;
}
```

### Message Thread

```css
.messages-thread {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  padding-right: 0.5rem;
}
```

### Message Layout

```css
.message {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.message-received {
  flex-direction: row;
}

.message-sent {
  flex-direction: row-reverse;
}
```

### Message Bubbles

```css
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

### Avatar Styles

```css
.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  color: var(--color-dark);
}
```

### Message Header

```css
.message-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.message-sender {
  font-weight: 600;
}

.message-time {
  color: var(--color-text-muted);
}
```

### Compose Area

```css
.message-compose {
  border-top: 2px solid var(--color-neutral-200);
  padding-top: 1rem;
}

.message-input-wrapper {
  position: relative;
  margin-bottom: 0.5rem;
}

.message-input-wrapper .form-textarea {
  padding-right: 3rem;
  min-height: 80px;
  resize: vertical;
}
```

### Emoji Toggle Button

```css
.emoji-toggle-btn {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-dark);
  opacity: 0.6;
  transition: opacity 0.2s ease;
  padding: 0.25rem;
}

.emoji-toggle-btn:hover {
  opacity: 1;
}
```

### Emoji Picker Wrapper

```css
.emoji-picker-wrapper {
  margin-bottom: 1rem;
}

.emoji-picker-wrapper.hidden {
  display: none;
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `client/portal.html` | Messages HTML (tab-messages section) |
| `src/features/client/modules/portal-messages.ts` | Message module (~270 lines) |
| `src/styles/client-portal/messages.css` | Message styling |
| `server/routes/messages.ts` | API endpoints |
| `server/services/email-service.ts` | Email notifications |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Notification preferences
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
