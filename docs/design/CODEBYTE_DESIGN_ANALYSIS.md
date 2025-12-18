# Codebyte.re - Complete Design Analysis

**URL:** https://codebyte.re/
**Creator:** Shelley Vohr (codebytere)
**Concept:** Interactive CLI portfolio - navigate via terminal commands
**Analysis Date:** December 2025

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Terminal Window Component](#4-terminal-window-component)
5. [Window Control Buttons](#5-window-control-buttons)
6. [Command System Architecture](#6-command-system-architecture)
7. [Shell Implementation](#7-shell-implementation)
8. [Animations & Transitions](#8-animations--transitions)
9. [Responsive Design](#9-responsive-design)
10. [File System Simulation](#10-file-system-simulation)
11. [Technical Implementation](#11-technical-implementation)
12. [Design Patterns to Steal](#12-design-patterns-to-steal)

---

## 1. Design Philosophy

### Core Concept

A portfolio that IS a terminal - not a portfolio WITH a terminal aesthetic. Users interact through actual CLI commands to discover content.

### Key Principles

1. **Function as Interface** - The terminal IS the navigation
2. **Developer-First** - Appeals directly to technical audience
3. **Minimal Chrome** - Only macOS window controls + terminal
4. **Discovery Through Exploration** - Users must explore to find content
5. **Authentic CLI UX** - Real command history, tab behavior, keyboard shortcuts

### What Makes It Unique

- Not a static page with terminal styling
- Actual working shell with file system simulation
- Commands like `ls`, `cd`, `cat` work as expected
- History navigation with arrow keys
- Fullscreen/minimize toggle via buttons or Escape key

---

## 2. Color System

### Primary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background (page) | `#211E3A` | Dark purple base |
| Terminal BG | `#30353a` | Dark gray shell area |
| Header | `#e0e8f0` | Light gray title bar |

### Text Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Default text | `#e0e8f0` | Standard output |
| Green | `#95F584` | Success, prompts, ASCII art |
| Pink | `#EC4891` | Highlights, errors |
| Cyan | `#88DEF2` | Links, special text |
| Gray | `#888` | Muted/secondary text |

### Window Button Colors (macOS Style)

| Color | Hex | Button |
|-------|-----|--------|
| Red | `#e75448` | Close |
| Yellow | `#e5c30f` | Minimize |
| Green | `#3bb662` | Fullscreen |

### Color Philosophy

The palette mimics actual terminal applications:

- Dark background reduces eye strain
- High contrast text for readability
- Semantic colors (green = success, red = error)
- macOS-native button colors for familiarity

---

## 3. Typography

### Font Stack

```css
font-family: "Menlo", "Monaco", "Consolas", "Courier New", "Courier", monospace;
```

**Menlo** is the primary choice - Apple's default monospace font, reinforcing the macOS terminal aesthetic.

### Font Size

```css
font-size: 11pt;
```

Small but readable - authentic terminal sizing.

### Text Styling

```css
/* No text decoration on links by default */
a {
  text-decoration: none;
  color: inherit;
}

/* Prompt styling */
.root {
  color: #95F584;  /* Green */
}

.tick {
  color: #EC4891;  /* Pink */
}
```

### ASCII Art Header

```
\[._.]/
```

Simple ASCII emoticon establishes playful tone while staying in terminal aesthetic.

---

## 4. Terminal Window Component

### Structure

```html
<div class="terminal-window">
  <header>
    <div class="button red"></div>
    <div class="button yellow"></div>
    <div class="button green"></div>
  </header>
  <div id="terminal">
    <!-- Content rendered here -->
  </div>
</div>
```

### Default Styling

```less
.terminal-window {
  width: 600px;
  height: 360px;
  position: absolute;
  top: 25vh;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.5s ease;
}

header {
  background-color: #e0e8f0;
  height: 30px;
  border-radius: 8px 8px 0 0;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

#terminal {
  background-color: #30353a;
  height: calc(100% - 30px);
  padding: 15px;
  overflow-y: auto;
}
```

### Window States

**Default:**
- 600x360px
- Centered at 25vh from top
- Rounded corners (10px)

**Minimized:**
- 250x30px (header only)
- Positioned at bottom of screen
- Only title bar visible

**Fullscreen:**
- 100% width and height
- Covers entire viewport
- No border radius

---

## 5. Window Control Buttons

### Structure

```html
<div class="button red"></div>
<div class="button yellow"></div>
<div class="button green"></div>
```

### Styling

```less
.button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
}

.button.red {
  background-color: #e75448;
}

.button.yellow {
  background-color: #e5c30f;
}

.button.green {
  background-color: #3bb662;
}
```

### Functionality

```javascript
// Green button toggles fullscreen
$('.button.green').click(() => {
  $('.terminal-window').toggleClass('fullscreen');
});

// Yellow button toggles minimized
$('.button.yellow').click(() => {
  $('.terminal-window').toggleClass('minimized');
});

// Escape key also toggles fullscreen
term.addEventListener('keydown', (evt) => {
  if (evt.keyCode === 27) {
    $('.terminal-window').toggleClass('fullscreen');
  }
});
```

---

## 6. Command System Architecture

### Available Commands

| Command | Function |
|---------|----------|
| `help` | Show available commands |
| `ls [dir]` | List directory contents |
| `cd [dir]` | Change directory |
| `cat [file].txt` | Display file contents |
| `path` | Show current path |
| `history` | View command history |
| `clear` | Clear terminal |

### Blocked Commands (Security)

```javascript
commands.mkdir = () => errors.noWriteAccess;
commands.touch = () => errors.noWriteAccess;
commands.rm = () => errors.noWriteAccess;
```

Returns: `"Error: you do not have write access to this directory"`

### Error Messages

```javascript
const errors = {
  invalidDirectory: 'Error: not a valid directory',
  noWriteAccess: 'Error: you do not have write access to this directory',
  fileNotFound: 'Error: file not found in current directory',
  fileNotSpecified: 'Error: you did not specify a file',
  invalidFile: 'Error: not a valid file',
};
```

### Directory Structure

```javascript
const struct = {
  root: ['about', 'resume', 'contact', 'talks'],
  skills: ['proficient', 'familiar'],
};

const rootPath = 'users/codebytere/root';
```

---

## 7. Shell Implementation

### Class Structure

```javascript
class Shell {
  constructor(term, commands) {
    this.commands = commands;
    this.setupListeners(term);
    this.term = term;

    // Initialize localStorage
    localStorage.directory = 'root';
    localStorage.history = JSON.stringify('');
    localStorage.historyIndex = -1;
    localStorage.inHistory = false;

    $('.input').focus();
  }
}
```

### Prompt Element

```html
<p class="hidden">
  <span class="prompt">
    <span class="root">root</span>
    <span class="tick">❯</span>
  </span>
  <span contenteditable="true" class="input" spellcheck="false"></span>
</p>
```

### Key Features

**1. Command History (Arrow Keys)**

```javascript
// Up arrow - previous command
if (key === keyUp) {
  if (localStorage.historyIndex >= 0) {
    $('.input').last().html(
      `${history[localStorage.historyIndex]}<span class="end"><span>`
    );
    if (localStorage.historyIndex != 0) {
      localStorage.historyIndex -= 1;
    }
  }
}

// Down arrow - next command
if (key === keyDown) {
  // ... navigate forward through history
}
```

**2. Command Execution**

```javascript
term.addEventListener('keypress', (evt) => {
  if (evt.keyCode === 13) {  // Enter key
    const input = prompt.textContent.trim().split(' ');
    const cmd = input[0].toLowerCase();
    const args = input[1];

    if (cmd === 'clear') {
      this.clearConsole();
    } else if (cmd in this.commands) {
      this.runCommand(cmd, args);
      this.resetPrompt(term, prompt);
    } else {
      this.term.innerHTML += 'Error: command not recognized';
    }
  }
});
```

**3. Dynamic Prompt Reset**

```javascript
resetPrompt(term, prompt) {
  const newPrompt = prompt.parentNode.cloneNode(true);
  prompt.setAttribute('contenteditable', false);
  term.appendChild(newPrompt);
  newPrompt.querySelector('.input').innerHTML = '';
  newPrompt.querySelector('.input').focus();
}
```

**4. History Persistence**

```javascript
updateHistory(command) {
  let history = localStorage.history;
  history = history ? Object.values(JSON.parse(history)) : [];
  history.push(command);
  localStorage.history = JSON.stringify(history);
  localStorage.historyIndex = history.length - 1;
}
```

---

## 8. Animations & Transitions

### Window State Transitions

```less
.terminal-window {
  transition: all 0.5s ease;
}
```

All state changes (default ↔ minimized ↔ fullscreen) animate smoothly over 0.5s.

### No Complex Animations

The design intentionally avoids:

- Typing animations
- Fade effects
- Loading spinners
- Scroll animations

This maintains the authentic, snappy feel of a real terminal.

---

## 9. Responsive Design

### Mobile Breakpoint

```less
@media (max-width: 650px) {
  .terminal-window {
    width: 95%;
    height: 60vh;
    top: 10vh;
  }
}
```

### Responsive Adjustments

| Property | Desktop | Mobile (< 650px) |
|----------|---------|------------------|
| Width | 600px | 95% |
| Height | 360px | 60vh |
| Position | 25vh from top | 10vh from top |

---

## 10. File System Simulation

### Content Loading

```javascript
// Load all page content via AJAX
const pages = [];
pages.push($.get('pages/about.html'));
pages.push($.get('pages/contact.html'));
pages.push($.get('pages/familiar.html'));
pages.push($.get('pages/help.html'));
pages.push($.get('pages/proficient.html'));
pages.push($.get('pages/resume.html'));
pages.push($.get('pages/root.html'));
pages.push($.get('pages/skills.html'));
pages.push($.get('pages/talks.html'));

$.when.apply($, pages).done((aboutData, contactData, ...) => {
  systemData['about'] = aboutData[0];
  systemData['contact'] = contactData[0];
  // ... etc
});
```

### File Access (cat command)

```javascript
commands.cat = (filename) => {
  if (!filename) return errors.fileNotSpecified;

  // Check if trying to cat a directory
  if (isADirectory(filename)) return errors.invalidFile;

  // Check file extension
  if (hasValidFileExtension(filename, '.txt')) {
    return systemData[fileKey];
  }

  return errors.fileNotFound;
};
```

### Directory Navigation (cd command)

```javascript
commands.cd = (newDirectory) => {
  const currDir = getDirectory();
  const dirs = Object.keys(struct);
  const newDir = newDirectory ? newDirectory.trim() : '';

  if (dirs.includes(newDir) && currDir !== newDir) {
    setDirectory(newDir);
  } else if (newDir === '' || newDir === '~' || newDir === '..') {
    setDirectory('root');
  } else {
    return errors.invalidDirectory;
  }
  return null;
};
```

---

## 11. Technical Implementation

### Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| jQuery | 3.2.1 | DOM manipulation |
| jQuery Terminal | 1.4.3 | Terminal functionality base |
| Less.js | 2.7.2 | CSS preprocessing |

### State Management

Uses `localStorage` for:

- Current directory
- Command history
- History navigation index
- History traversal state

### Key Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Execute command |
| Up Arrow | Previous command |
| Down Arrow | Next command |
| Escape | Toggle fullscreen |
| Tab | Prevented (no autocomplete) |
| Backspace/Delete | Reset history index |

---

## 12. Design Patterns to Steal

### 1. Terminal as Primary Interface

Don't add a terminal to your site - make your site a terminal:

```javascript
class Shell {
  constructor(element, commands) {
    this.commands = commands;
    this.setupListeners(element);
  }
}
```

### 2. macOS Window Chrome

```css
.window {
  border-radius: 10px;
  overflow: hidden;
}

.window-header {
  background: #e0e8f0;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.window-button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
```

### 3. Contenteditable Input

```html
<span contenteditable="true" class="input" spellcheck="false"></span>
```

Allows inline editing without form elements.

### 4. Command History with localStorage

```javascript
// Save
localStorage.history = JSON.stringify(historyArray);

// Retrieve
const history = JSON.parse(localStorage.history);
```

### 5. Semantic Color System

```css
.green { color: #95F584; }   /* Success, active */
.pink { color: #EC4891; }    /* Accent, prompt */
.cyan { color: #88DEF2; }    /* Links, info */
.gray { color: #888; }       /* Muted */
```

### 6. State-Based Window Classes

```css
.terminal-window { /* default */ }
.terminal-window.minimized { /* collapsed */ }
.terminal-window.fullscreen { /* expanded */ }
```

### 7. Blocked Commands Pattern

```javascript
commands.rm = () => "Error: you do not have write access";
```

Maintains illusion while preventing actual operations.

### 8. Dynamic Prompt Cloning

```javascript
const newPrompt = prompt.parentNode.cloneNode(true);
prompt.setAttribute('contenteditable', false);
term.appendChild(newPrompt);
```

Creates new input line after each command.

---

## How This Applies to nobhad.codes

Your site already has terminal elements. This analysis suggests:

1. **Consider a dedicated `/terminal` or `/cli` page** that's purely terminal-based
2. **Add command history** to any terminal interactions
3. **Use the macOS window chrome** for terminal sections
4. **Implement the same color semantics** (green for success, etc.)
5. **Allow keyboard navigation** (arrow keys, Escape, Enter)

---

## File Reference

| File | Contents |
|------|----------|
| `codebyte` | HTML structure |
| `codebyte-cli.js` | Command definitions, content loading |
| `codebyte-shell.js` | Shell class, input handling, history |

---

## Sources

- [codebytere/codebytere.github.io on GitHub](https://github.com/codebytere/codebytere.github.io)
- [Terminal Portfolio Topic on GitHub](https://github.com/topics/terminal-portfolio)
