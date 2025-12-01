# Messaging System

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Components](#components)
4. [Emoji Picker](#emoji-picker)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Backend Integration](#backend-integration)
7. [Styling](#styling)
8. [File Locations](#file-locations)

---

## Overview

The messaging system provides real-time communication between clients and developers within the Client Portal. Messages are displayed in a thread view with sender identification, timestamps, and avatar images.

**Access:** Client Portal > Messages tab

---

## Features

| Feature | Description |
|---------|-------------|
| Thread View | Chronological message display |
| Emoji Picker | Native emoji keyboard via web component |
| Enter to Send | Quick message sending with keyboard |
| Sender Identification | Visual distinction between sent/received |
| Timestamps | Date and time for each message |
| Avatar Display | Profile images for sender identification |

---

## Components

### Message Thread

Container for all messages in the conversation:

```html
<div class="messages-thread" id="messages-thread">
  <div class="message message-received">...</div>
  <div class="message message-sent">...</div>
</div>
```

### Message Structure

**Received Message:**
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

**Sent Message:**
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

### Message Compose Area

```html
<div class="message-compose">
  <div class="message-input-wrapper">
    <textarea id="message-input" class="form-textarea"
              placeholder="Type your message..."></textarea>
    <button type="button" class="emoji-toggle-btn" id="emoji-toggle">
      <!-- Smiley face SVG -->
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

### Implementation

Uses `emoji-picker-element` web component (vanilla JS/TS alternative to React's `emoji-picker-react`).

**Package:** `emoji-picker-element`

**Import:**
```typescript
import 'emoji-picker-element';
```

### Event Handling

```typescript
// Toggle picker visibility
emojiToggle.addEventListener('click', () => {
  emojiPickerWrapper.classList.toggle('hidden');
});

// Handle emoji selection
emojiPicker.addEventListener('emoji-click', (event: Event) => {
  const customEvent = event as CustomEvent;
  if (messageInput && customEvent.detail?.unicode) {
    const emoji = customEvent.detail.unicode;
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;
    // Insert emoji at cursor position
    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
  }
});

// Close picker when clicking outside
document.addEventListener('click', (e) => {
  if (!emojiPickerWrapper.contains(e.target as Node) &&
      e.target !== emojiToggle &&
      !emojiToggle.contains(e.target as Node)) {
    emojiPickerWrapper.classList.add('hidden');
  }
});
```

### CSS Theming

The emoji picker uses CSS custom properties for theming:

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

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |

**Implementation:**
```typescript
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendButton.click();
  }
});
```

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages/threads` | GET | Load message threads |
| `/api/messages/threads` | POST | Create new thread |
| `/api/messages/threads/:id/messages` | POST | Send message |
| `/api/messages/preferences` | GET/PUT | Notification preferences |

### Database Schema

**Messages Table:**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
```

**Message Threads Table:**
```sql
CREATE TABLE message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  subject TEXT,
  thread_type TEXT DEFAULT 'general',
  project_id INTEGER,
  priority TEXT DEFAULT 'normal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
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
  portalUrl: 'https://portal.nobhadcodes.com',
  hasAttachments: false
});
```

---

## Styling

### Message Container

```css
.messages-container {
  background: var(--color-neutral-300);
  border: 4px solid #000000;
  padding: 1.5rem;
}
```

### Message Bubbles

```css
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
}

.avatar-placeholder {
  background: var(--color-neutral-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `templates/pages/client-portal.ejs:129-181` | Messages HTML template |
| `src/features/client/client-portal.ts:195-240` | Message event handlers |
| `src/styles/pages/client-portal.css` | Message styling |
| `src/modules/messaging.ts` | Messaging module (if separate) |
| `server/routes/messages.ts` | API endpoints |
| `server/services/email-service.ts` | Email notifications |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Notification preferences
