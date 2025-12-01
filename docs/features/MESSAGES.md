# Messaging System

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [HTML Structure](#html-structure)
4. [Components](#components)
5. [Emoji Picker](#emoji-picker)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [TypeScript Implementation](#typescript-implementation)
8. [Backend Integration](#backend-integration)
9. [Styling](#styling)
10. [File Locations](#file-locations)

---

## Overview

The messaging system provides real-time communication between clients and developers within the Client Portal. Messages are displayed in a thread view with sender identification, timestamps, and avatar images.

**Access:** Client Portal > Messages tab (`tab-messages`)

---

## Features

| Feature | Description |
|---------|-------------|
| Thread View | Chronological message display |
| Emoji Picker | Native emoji keyboard via `emoji-picker-element` web component |
| Enter to Send | Quick message sending with keyboard |
| Shift+Enter | Insert newline without sending |
| Sender Identification | Visual distinction between sent/received |
| Timestamps | Date and time for each message |
| Avatar Display | Profile images for sender identification |
| Click-outside Close | Emoji picker closes when clicking outside |

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
// src/features/client/client-portal.ts:195-228
// Emoji picker (using emoji-picker-element web component)
const emojiToggle = document.getElementById('emoji-toggle');
const emojiPickerWrapper = document.getElementById('emoji-picker-wrapper');
const emojiPicker = document.getElementById('emoji-picker');
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('btn-send-message');

if (emojiToggle && emojiPickerWrapper && emojiPicker) {
  // Toggle picker visibility
  emojiToggle.addEventListener('click', () => {
    emojiPickerWrapper.classList.toggle('hidden');
  });

  // Handle emoji selection from web component
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
      // Move cursor after inserted emoji
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

### Loading Messages

```typescript
// src/features/client/client-portal.ts:653-673
private loadMessages(): void {
  if (!this.currentProject) return;

  const messagesContainer = document.getElementById('messages-list');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';

  this.currentProject.messages.forEach((message: any) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${message.senderRole}`;
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${message.sender}</span>
        <span class="message-time">${this.formatDate(message.timestamp)}</span>
      </div>
      <div class="message-content">${message.message}</div>
    `;
    messagesContainer.appendChild(messageElement);
  });
}
```

### Message Data Interface

```typescript
interface ProjectMessage {
  id: string;
  sender: string;
  senderRole: 'system' | 'client' | 'admin';
  message: string;
  timestamp: string;
  isRead: boolean;
}
```

### Sample Message Data

```typescript
// src/features/client/client-portal.ts:434-443
messages: [
  {
    id: 'msg-001',
    sender: 'No Bhad Codes Team',
    senderRole: 'system',
    message: 'Welcome to your project portal! We\'ll keep you updated on progress here.',
    timestamp: new Date().toISOString(),
    isRead: false
  }
]
```

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages/threads` | GET | Load message threads |
| `/api/messages/threads` | POST | Create new thread |
| `/api/messages/threads/:id/messages` | GET | Get messages in thread |
| `/api/messages/threads/:id/messages` | POST | Send message |
| `/api/messages/preferences` | GET | Get notification preferences |
| `/api/messages/preferences` | PUT | Update notification preferences |

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

| File | Lines | Purpose |
|------|-------|---------|
| `templates/pages/client-portal.ejs` | 128-181 | Messages HTML template |
| `src/features/client/client-portal.ts` | 195-240 | Message event handlers |
| `src/features/client/client-portal.ts` | 653-673 | Load messages function |
| `src/styles/pages/client-portal.css` | - | Message styling |
| `server/routes/messages.ts` | - | API endpoints |
| `server/services/email-service.ts` | - | Email notifications |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Notification preferences
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Styling system
