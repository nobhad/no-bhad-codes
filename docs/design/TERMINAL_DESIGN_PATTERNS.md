# Terminal Portfolio Design Patterns - Combined Analysis

**Sources:** codebyte.re (Shelley Vohr) + saloni-garg.github.io (Saloni Garg)
**Target:** nobhad.codes terminal intake overhaul
**Analysis Date:** December 2025

---

## Table of Contents

1. [Shared Design Patterns](#1-shared-design-patterns)
2. [Color Systems Comparison](#2-color-systems-comparison)
3. [Typography Standards](#3-typography-standards)
4. [Terminal Window Chrome](#4-terminal-window-chrome)
5. [Input & Interaction Patterns](#5-input--interaction-patterns)
6. [Animation Philosophy](#6-animation-philosophy)
7. [Command System Architecture](#7-command-system-architecture)
8. [Current nobhad.codes Analysis](#8-current-nobhadcodes-analysis)
9. [Implementation Plan](#9-implementation-plan)
10. [Technical Specifications](#10-technical-specifications)

---

## 1. Shared Design Patterns

Both terminal portfolios share these core patterns:

### 1.1 Monospace-Only Typography

```css
/* Codebyte */
font-family: "Menlo", "Monaco", "Consolas", "Courier New", "Courier", monospace;

/* Saloni Garg */
font-family: "Roboto Mono", monospace;
```

**Principle:** Single monospace font throughout. No font variation = authentic terminal feel.

### 1.2 Dark Background, High Contrast Text

|Site|Background|Primary Text|
|------|------------|--------------|
|Codebyte|`#30353a` (dark gray)|`#e0e8f0` (light gray)|
|Saloni Garg|`#000000` (pure black)|`#7FF709` (matrix green)|

**Principle:** Dark backgrounds reduce eye strain and feel authentic to terminal applications.

### 1.3 Prompt Prefixes

Both use visual indicators to simulate shell prompts:

```html
<!-- Codebyte - user@host style -->
<span class="root">root</span>
<span class="tick">❯</span>

<!-- Saloni Garg - simple arrow -->
<p>> I write code</p>
```

### 1.4 Semantic Color Coding

|Purpose|Codebyte|Saloni Garg|
|---------|----------|-------------|
|Success/Active|`#95F584` (green)|`#7FF709` (green)|
|Accent/Interactive|`#EC4891` (pink)|`#268bd2` (blue)|
|Links|`#88DEF2` (cyan)|`#7FF709` (green)|
|Muted|`#888` (gray)|-|

### 1.5 No Decorative Elements

Neither site uses:

- Gradients
- Drop shadows (except subtle window shadow)
- Border radius (except window chrome)
- Icons (except Font Awesome in Saloni Garg)
- Images (except avatar)

### 1.6 Keyboard-First Navigation

|Feature|Codebyte|Saloni Garg|
|---------|----------|-------------|
|Number keys for options|No|No|
|Arrow key history|Yes|No|
|Escape for fullscreen|Yes|No|
|Enter to submit|Yes|Implicit|

---

## 2. Color Systems Comparison

### 2.1 Codebyte Palette (Multi-Color Terminal)

```css
/* Background */
--terminal-bg: #30353a;
--page-bg: #211E3A;
--header-bg: #e0e8f0;

/* Text */
--text-default: #e0e8f0;
--text-green: #95F584;
--text-pink: #EC4891;
--text-cyan: #88DEF2;
--text-muted: #888;

/* Window Buttons */
--btn-close: #e75448;
--btn-minimize: #e5c30f;
--btn-maximize: #3bb662;
```

### 2.2 Saloni Garg Palette (Classic Green Terminal)

```css
/* Background */
--terminal-bg: #000000;

/* Text */
--text-primary: #7FF709;
--text-hover: #268bd2;
--text-accent: #11999E;
```

### 2.3 Recommendation for nobhad.codes

**Hybrid approach:** Keep existing green-on-dark aesthetic but add semantic colors:

```css
/* Already defined in nobhad.codes CSS variables */
--color-terminal-bg: /* dark background */
--color-terminal-green: /* primary text */
--color-terminal-blue: /* links/interactive */
--color-terminal-pink: /* errors/accents */
--color-terminal-text-muted: /* secondary info */
```

---

## 3. Typography Standards

### 3.1 Font Stack Priority

```css
/* Recommended - matches both sites */
font-family:
  "Menlo",           /* macOS default */
  "Monaco",          /* macOS fallback */
  "Consolas",        /* Windows */
  "Courier New",     /* Universal fallback */
  "Courier",
  monospace;
```

### 3.2 Font Sizing Philosophy

**Codebyte:** `11pt` - Small, authentic terminal size
**Saloni Garg:** `1.2em` base, all elements `1em` - Flat hierarchy

**Principle:** Terminal text should be smaller than typical web text. All content same size unless semantically different.

### 3.3 Flat Typography Hierarchy

```css
/* Saloni Garg approach - everything equal */
h1, h2, h3, p, li {
  font-size: 1em;
  font-weight: normal;
}
```

No visual hierarchy through font size - content structure comes from:

- Prompt prefixes (`>`, `$`, `❯`)
- Indentation
- Color coding
- Line breaks

---

## 4. Terminal Window Chrome

### 4.1 macOS Window Structure

```html
<div class="terminal-window">
  <header class="terminal-header">
    <div class="button close"></div>
    <div class="button minimize"></div>
    <div class="button maximize"></div>
    <span class="terminal-title">title.sh</span>
  </header>
  <div class="terminal-content">
    <!-- Terminal content -->
  </div>
</div>
```

### 4.2 Traffic Light Buttons

```css
.button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
}

.button.close { background-color: #e75448; }
.button.minimize { background-color: #e5c30f; }
.button.maximize { background-color: #3bb662; }
```

### 4.3 Window States (Codebyte Pattern)

```css
/* Default */
.terminal-window {
  width: 600px;
  height: 360px;
  border-radius: 10px;
  transition: all 0.5s ease;
}

/* Minimized */
.terminal-window.minimized {
  width: 250px;
  height: 30px; /* Header only */
  bottom: 20px;
}

/* Fullscreen */
.terminal-window.fullscreen {
  width: 100%;
  height: 100%;
  border-radius: 0;
}
```

---

## 5. Input & Interaction Patterns

### 5.1 Contenteditable vs Input Field

**Codebyte:** Uses `contenteditable` span

```html
<span contenteditable="true" class="input" spellcheck="false"></span>
```

**nobhad.codes (current):** Uses standard input

```html
<input type="text" class="terminal-input" autocomplete="off">
```

**Recommendation:** Keep input field (better accessibility, form handling) but style to match contenteditable appearance.

### 5.2 Command History (Codebyte Pattern)

```javascript
class Shell {
  constructor() {
    localStorage.history = JSON.stringify('');
    localStorage.historyIndex = -1;
  }

  updateHistory(command) {
    let history = JSON.parse(localStorage.history) || [];
    history.push(command);
    localStorage.history = JSON.stringify(history);
    localStorage.historyIndex = history.length - 1;
  }

  // Arrow up - previous command
  handleKeyUp(e) {
    if (e.keyCode === 38 && localStorage.historyIndex >= 0) {
      const history = JSON.parse(localStorage.history);
      this.input.value = history[localStorage.historyIndex];
      localStorage.historyIndex--;
    }
  }
}
```

### 5.3 Option Selection Patterns

**Current nobhad.codes:** Number keys + click

```javascript
// Already implemented - keep this!
document.addEventListener('keydown', (e) => {
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= options.length) {
    selectOption(options[num - 1]);
  }
});
```

### 5.4 Blocked Commands (Codebyte Pattern)

```javascript
// Maintain illusion while preventing operations
commands.rm = () => "Error: you do not have write access";
commands.mkdir = () => "Error: you do not have write access";
commands.sudo = () => "Nice try.";
```

---

## 6. Animation Philosophy

### 6.1 Codebyte Approach: Minimal Animation

- Only window state transitions (0.5s ease)
- No typing animations
- No loading spinners
- Instant command response

**Why:** Authentic terminal feel is FAST and responsive.

### 6.2 Saloni Garg Approach: Progressive Reveal

- Typing animation for name
- Section fadeIn on "learn more" click
- Boot sequence messaging

### 6.3 nobhad.codes Current: Heavy Animation

- Typing effect on AI messages
- Avatar intro animation
- Boot sequence with delays
- Progress bar animation

### 6.4 Recommendation

**Keep some animation but reduce delays:**

|Current|Recommended|
|---------|-------------|
|600ms typing indicator|300ms typing indicator|
|15-25ms per character|8-12ms per character|
|1000ms cursor pause after message|400ms cursor pause|
|300-400ms boot line delays|150-200ms boot line delays|

**Animation philosophy:** Feel responsive like a real terminal, but maintain the "AI is typing" illusion.

---

## 7. Command System Architecture

### 7.1 Codebyte Command Structure

```javascript
const commands = {};

commands.help = () => systemData.help;
commands.ls = (dir) => listDirectory(dir);
commands.cd = (dir) => changeDirectory(dir);
commands.cat = (file) => readFile(file);
commands.path = () => getCurrentPath();
commands.history = () => formatHistory();
commands.clear = () => clearTerminal();
```

### 7.2 Error Handling

```javascript
const errors = {
  invalidDirectory: 'Error: not a valid directory',
  noWriteAccess: 'Error: you do not have write access',
  fileNotFound: 'Error: file not found',
  fileNotSpecified: 'Error: you did not specify a file',
  invalidFile: 'Error: not a valid file',
};
```

### 7.3 Directory Structure Simulation

```javascript
const struct = {
  root: ['about', 'resume', 'contact', 'projects'],
  projects: ['web', 'mobile', 'cli'],
};

const rootPath = 'users/guest/nobhad';
```

---

## 8. Current nobhad.codes Analysis

### 8.1 Strengths (Keep These)

1. **GSAP animations** - Already using GSAP, excellent
2. **CSS variables** - Proper theming system
3. **macOS window chrome** - Traffic light buttons present
4. **Number key selection** - Good UX for options
5. **Progress tracking** - Nice visual feedback
6. **Session persistence** - localStorage for progress
7. **Accessibility** - ARIA labels, roles present
8. **Custom block cursor** - Authentic terminal feel

### 8.2 Gaps vs Reference Sites

|Feature|Codebyte|Saloni|nobhad.codes|
|---------|----------|--------|--------------|
|CLI commands|Yes|No|No|
|Command history (arrows)|Yes|No|Partial (goBack)|
|Window minimize|Yes|No|Yes|
|Window fullscreen|Yes|No|Yes|
|Escape key fullscreen|Yes|No|No|
|Prompt prefix styling|Yes|Yes|Partial|
|Flat typography|No|Yes|No|
|Boot sequence|No|Yes|Yes|
|Typing animation|No|Yes|Yes|

### 8.3 Current File Structure

```text
src/features/client/
  terminal-intake.ts        # Main module class
  terminal-intake-ui.ts     # UI rendering, animations
  terminal-intake-data.ts   # Questions, options
  terminal-intake-types.ts  # TypeScript types

src/styles/pages/
  terminal-intake.css       # All terminal styles
```

---

## 9. Implementation Plan

### Phase 1: Quick Wins (No Breaking Changes)

**Goal:** Improve feel without changing functionality

#### 1.1 Add Escape Key Fullscreen Toggle

```typescript
// In terminal-intake.ts bindEvents()
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('intakeModal');
    modal?.classList.toggle('fullscreen');
  }
});
```

#### 1.2 Speed Up Animations

```typescript
// In terminal-intake-ui.ts
const TYPING_SPEED = {
  AI_MESSAGE: 10,      // Was 15-25ms
  SYSTEM_MESSAGE: 5,   // Was 8-13ms
  CURSOR_PAUSE: 400,   // Was 1000ms
  BOOT_DELAY: 150,     // Was 300-400ms
  TYPING_INDICATOR: 300 // Was 600ms
};
```

#### 1.3 Add Command History (Arrow Keys)

```typescript
// In terminal-intake.ts
private inputHistory: string[] = [];
private historyIndex = -1;

private bindArrowKeyHistory(): void {
  this.inputElement?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && this.historyIndex > 0) {
      e.preventDefault();
      this.historyIndex--;
      this.inputElement!.value = this.inputHistory[this.historyIndex];
    }
    if (e.key === 'ArrowDown' && this.historyIndex < this.inputHistory.length - 1) {
      e.preventDefault();
      this.historyIndex++;
      this.inputElement!.value = this.inputHistory[this.historyIndex];
    }
  });
}

// Call in processAnswer after saving answer
this.inputHistory.push(displayValue);
this.historyIndex = this.inputHistory.length;
```

### Phase 2: Visual Refinements

#### 2.1 Flatten Typography Hierarchy

```css
/* In terminal-intake.css */
.terminal-intake,
.terminal-intake * {
  font-size: 14px; /* Single size */
  line-height: 1.6;
}

.terminal-title {
  font-size: 13px; /* Slightly smaller for header */
}
```

#### 2.2 Improve Prompt Styling

```css
/* More prominent prompt prefixes */
.chat-message.ai .message-content::before {
  content: "❯ ";
  color: var(--color-terminal-green);
  font-weight: bold;
}

.chat-message.user .message-content::before {
  content: "$ ";
  color: var(--color-terminal-blue);
}
```

#### 2.3 Add Semantic Message Colors

```css
.chat-message.ai .message-content {
  color: var(--color-terminal-green);
}

.chat-message.user .message-content {
  color: var(--color-terminal-text);
}

.chat-message.error .message-content {
  color: var(--color-terminal-pink);
}

.chat-message.success .message-content {
  color: var(--color-terminal-cyan);
}
```

### Phase 3: Optional CLI Mode

**Goal:** Add `/commands` that work alongside the intake flow

#### 3.1 Command Parser

```typescript
// New file: terminal-intake-commands.ts
export interface TerminalCommand {
  name: string;
  description: string;
  handler: (args?: string) => string | Promise<string>;
}

export const TERMINAL_COMMANDS: Record<string, TerminalCommand> = {
  help: {
    name: 'help',
    description: 'Show available commands',
    handler: () => formatHelpText()
  },
  clear: {
    name: 'clear',
    description: 'Clear the terminal',
    handler: () => 'CLEAR_SIGNAL'
  },
  restart: {
    name: 'restart',
    description: 'Restart the intake process',
    handler: () => 'RESTART_SIGNAL'
  },
  skip: {
    name: 'skip',
    description: 'Skip current question (if optional)',
    handler: () => 'SKIP_SIGNAL'
  },
  back: {
    name: 'back',
    description: 'Go back to previous question',
    handler: () => 'BACK_SIGNAL'
  },
  status: {
    name: 'status',
    description: 'Show current progress',
    handler: () => formatStatusText()
  }
};
```

#### 3.2 Command Detection in Input Handler

```typescript
private async handleUserInput(): Promise<void> {
  const input = this.inputElement?.value.trim();
  if (!input) return;

  // Check for CLI commands (start with /)
  if (input.startsWith('/')) {
    const [cmd, ...args] = input.slice(1).split(' ');
    await this.handleCommand(cmd.toLowerCase(), args.join(' '));
    return;
  }

  // Continue with normal intake flow
  // ... existing code
}

private async handleCommand(cmd: string, args: string): Promise<void> {
  const command = TERMINAL_COMMANDS[cmd];

  if (!command) {
    this.addMessage({
      type: 'error',
      content: `Command not found: ${cmd}. Type /help for available commands.`
    });
    return;
  }

  const result = await command.handler(args);

  switch (result) {
    case 'CLEAR_SIGNAL':
      this.chatContainer!.innerHTML = '';
      break;
    case 'RESTART_SIGNAL':
      this.clearProgress();
      this.currentQuestionIndex = 0;
      await this.startConversation();
      break;
    case 'BACK_SIGNAL':
      if (this.currentQuestionIndex > 0) {
        await this.goBackToQuestion(this.currentQuestionIndex - 1);
      }
      break;
    default:
      this.addMessage({ type: 'system', content: result });
  }

  if (this.inputElement) this.inputElement.value = '';
}
```

---

## 10. Technical Specifications

### 10.1 CSS Variables to Add/Update

```css
:root {
  /* Timing - add these */
  --terminal-typing-speed: 10ms;
  --terminal-cursor-blink: 500ms;
  --terminal-boot-delay: 150ms;
  --terminal-transition: 0.3s ease;

  /* Colors - verify these exist */
  --color-terminal-cyan: #88DEF2;
  --color-terminal-pink: #EC4891;
}
```

### 10.2 Keyboard Shortcuts Reference

|Key|Action|Priority|
|-----|--------|----------|
|`1-9`|Select option|Existing|
|`Enter`|Submit input|Existing|
|`Arrow Up`|Previous history|Phase 1|
|`Arrow Down`|Next history|Phase 1|
|`Escape`|Toggle fullscreen|Phase 1|
|`/help`|Show commands|Phase 3|
|`/clear`|Clear terminal|Phase 3|
|`/back`|Go back|Phase 3|

### 10.3 Animation Timing Reference

|Animation|Current|Target|GSAP Config|
|-----------|---------|--------|-------------|
|Character typing|15-25ms|8-12ms|`delay: 0.01`|
|Cursor blink|500ms|500ms|`duration: 0.5, repeat: -1, yoyo: true`|
|Message fade|-|200ms|`duration: 0.2, ease: 'power2.out'`|
|Window state|500ms|300ms|`duration: 0.3, ease: 'power2.inOut'`|

### 10.4 Accessibility Checklist

- [x] ARIA labels on inputs
- [x] Role="log" on chat container
- [x] aria-live="polite" for updates
- [ ] Focus management after commands
- [ ] Screen reader announcements for state changes
- [ ] Keyboard trap handling in fullscreen

---

## Implementation Priority Order

1. **Escape key fullscreen** - 5 minutes, high impact
2. **Speed up animations** - 15 minutes, improves feel significantly
3. **Arrow key history** - 30 minutes, expected terminal behavior
4. **Flatten typography** - 10 minutes, more authentic
5. **Improve prompt styling** - 10 minutes, visual polish
6. **CLI commands (optional)** - 2-3 hours, nice-to-have

---

## Files to Modify

|File|Changes|
|------|---------|
|`terminal-intake.ts`|Escape key, arrow history, command handling|
|`terminal-intake-ui.ts`|Animation timing constants|
|`terminal-intake.css`|Typography, prompt styling|
|`terminal-intake-commands.ts`|New file for CLI commands (Phase 3)|

---

## Reference Links

- [Codebyte Source](https://github.com/codebytere/codebytere.github.io)
- [Terminal Portfolio Topic](https://github.com/topics/terminal-portfolio)
- [GSAP Documentation](https://greensock.com/docs/)
