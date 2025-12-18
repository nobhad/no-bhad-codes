# Saloni Garg Portfolio - Complete Design Analysis

**URL:** https://saloni-garg.github.io/
**Creator:** Saloni Garg
**Concept:** Terminal-styled bio page with typing animation
**Analysis Date:** December 2025

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Layout Structure](#4-layout-structure)
5. [Terminal Prompt Styling](#5-terminal-prompt-styling)
6. [Progressive Reveal Pattern](#6-progressive-reveal-pattern)
7. [Link Interactions](#7-link-interactions)
8. [Section Organization](#8-section-organization)
9. [Responsive Considerations](#9-responsive-considerations)
10. [Technical Implementation](#10-technical-implementation)
11. [Design Patterns to Steal](#11-design-patterns-to-steal)

---

## 1. Design Philosophy

### Core Concept

A developer bio page styled like terminal output - content appears as if typed by a shell prompt. Simpler than codebyte.re - focuses on aesthetic rather than full CLI functionality.

### Key Principles

1. **Terminal Aesthetic, Not Terminal Function** - Looks like CLI, but standard page navigation
2. **Progressive Disclosure** - Content reveals section by section
3. **Monospace Everything** - Single font family throughout
4. **High Contrast** - Bright green on pure black
5. **Minimal Interaction** - No complex CLI, just styled content

### What Makes It Unique

- Uses `>` prefix to simulate shell prompts
- Typing animation for name reveal
- "Learn more" expands additional sections
- Fake terminal input at bottom (decorative)

---

## 2. Color System

### Primary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#000000` | Pure black |
| Primary Text | `#7FF709` | Bright terminal green |
| Accent/Hover | `#268bd2` | Blue highlight |
| Secondary | `#11999E` | Teal for special text |

### Complete Color Reference (from comments)

```css
/* COLORS: http://colorhunt.co/c/14832
#E4F9F5 - Light mint (unused)
#30E3CA - Bright cyan (unused)
#11999E - Teal (used for .primary)
#40514E - Dark teal (unused)
#268bd2 - Blue (hover states)
*/
```

### Color Usage

```css
body {
  background-color: #000;
  color: #7FF709;
}

a {
  color: #7FF709;  /* Inherits green */
}

a:hover {
  background-color: #268bd2;  /* Blue highlight */
}

.primary {
  color: #11999E;  /* Teal accent */
}

div#attention {
  color: #11999E;  /* Teal for emphasis */
}
```

### Why This Works

- `#7FF709` is classic "matrix green" - instantly recognizable as terminal
- Pure black (`#000`) maximizes contrast
- Blue hover (`#268bd2`) provides clear interaction feedback
- Limited palette maintains focus

---

## 3. Typography

### Font Stack

```css
font-family: "Roboto Mono", monospace;
```

**Roboto Mono** - Google's monospace variant, clean and readable.

### Font Loading

```html
<link href='https://fonts.googleapis.com/css?family=Roboto+Mono' rel='stylesheet'>
```

### Font Sizing

```css
body {
  font-size: 1.2em;  /* Base size slightly larger than default */
}

h1, h2, p {
  font-size: 1em;  /* All same size - flat hierarchy */
}
```

### Typography Philosophy

**Everything is the same size.** No visual hierarchy through font size - all content is equal importance, like actual terminal output.

---

## 4. Layout Structure

### HTML Structure

```html
<div id="terminal"></div>  <!-- Typing animation target -->

<section id="general-info">
  <img id="portrait-photo" />
  <h1 id="name"></h1>
  <h2 id="profession"></h2>
  <p id="one-line">> I write code</p>
  <p class="learn">> learn more</p>
</section>

<section id="online-presence">
  <p>> I also:</p>
  <ul class="activities">...</ul>
</section>

<section id="abilities-first">
  <div id="skills">...</div>
  <div id="familiar">...</div>
</section>

<section id="terminal-line">
  <p>> <input id="term-prompt" /></p>
</section>
```

### Section Styling

```css
section {
  margin: 0 auto 2%;
  width: 50%;
}
```

- All sections centered
- 50% viewport width
- 2% bottom margin between sections

### Initial Hidden State

```css
#general-info,
.learn {
  display: none;
}

#short-bio,
#online-presence,
#abilities-first {
  display: none;
}

#terminal-line {
  display: none;
}
```

Content starts hidden, revealed progressively via JavaScript.

---

## 5. Terminal Prompt Styling

### Prompt Character

All content prefixed with `>` to simulate shell prompt:

```html
<p>> I write code</p>
<p>> list skill</p>
<p>> where <skill> is one of:</p>
```

### Input Field (Decorative)

```css
#term-prompt {
  background-color: #000;
  border: none;
  color: #7FF709;
  outline: none;
  margin-bottom: 300px;
}
```

Creates appearance of active terminal without functionality.

### Subresult Indentation

```css
.subresult {
  padding-left: 10%;
}
```

Indented content simulates command output:

```html
<p>> list skill</p>
<p>> where <skill> is one of:</p>
<p class="subresult">HTML5, CSS3, ReactJS, Golang, D3, GIT and Github</p>
```

---

## 6. Progressive Reveal Pattern

### "Learn More" Expansion

```css
.learn {
  cursor: pointer;
}

.expand:hover {
  background-color: #268bd2;
}
```

```html
<p class="learn">> <span class="expand">learn more</span></p>
```

Clicking reveals additional sections (handled by `next.js`).

### Animation Flow

1. Page loads with terminal typing animation
2. Name types out character by character
3. Profession types out
4. "Learn more" prompt appears
5. Click reveals online presence + skills sections
6. Fake terminal input appears at bottom

---

## 7. Link Interactions

### Base Link Style

```css
a {
  color: #7FF709;  /* Same as text - no distinction */
}
```

### Hover State

```css
a:hover {
  text-decoration: underline;
  background-color: #268bd2;
}
```

Blue background highlight on hover - strong visual feedback.

### Link Pattern

Links are action-oriented verbs:

```html
<p>> I <a href="...">write</a> <a href="...">code</a></p>

<ul class="activities">
  <li><i class="fa fa-suitcase"></i> <a href="...">work</a></li>
  <li><i class="fa fa-github"></i> <a href="...">build</a></li>
  <li><i class="fa fa-code"></i> <a href="...">improve</a></li>
  <li><i class="fa fa-linkedin"></i> <a href="...">network</a></li>
  <li><i class="fa fa-twitter"></i> <a href="...">tweet</a></li>
</ul>
```

---

## 8. Section Organization

### General Info

```html
<section id="general-info">
  <img id="portrait-photo" src="img/Alex2.jpg" />
  <h1 id="name"></h1>
  <h2 id="profession"></h2>
  <p id="one-line">> I write code</p>
  <p class="learn">> learn more</p>
</section>
```

Portrait photo (hidden by default):

```css
#portrait-photo {
  height: 150px;
  width: 150px;
  display: none;
  margin-left: auto;
  margin-right: auto;
  border-radius: 50%;
}
```

### Online Presence

```html
<section id="online-presence">
  <p>> I also:</p>
  <ul class="activities">
    <li><i class="fa fa-suitcase"></i> <a href="...">work</a></li>
    <!-- ... -->
  </ul>
</section>
```

Activity list styling:

```css
ul.activities li {
  display: inline;
  margin: 10px 10px 0;
  padding-left: 5%;
}
```

### Skills Section

```html
<section id="abilities-first">
  <div id="skills">
    <p>> list skill</p>
    <p>> where &lt;skill&gt; is one of:</p>
    <p class="subresult">HTML5, CSS3, ReactJS, Golang...</p>
  </div>

  <div id="familiar">
    <p>> list familiar area:</p>
    <p>> where &lt;area&gt; is one of:</p>
    <p class="subresult">Haxe, OpenFL, Python, THREE.js, Node.js</p>
  </div>
</section>
```

---

## 9. Responsive Considerations

### Current Approach

```css
section {
  width: 50%;
  margin: 0 auto;
}
```

Fixed 50% width - no explicit media queries in provided CSS.

### Potential Issues

- 50% width may be too narrow on mobile
- No breakpoints defined
- Font size might need scaling

### Suggested Improvements

```css
@media (max-width: 768px) {
  section {
    width: 90%;
  }

  body {
    font-size: 1em;
  }
}
```

---

## 10. Technical Implementation

### Dependencies

| Library | Purpose |
|---------|---------|
| jQuery 3.1.0 | DOM manipulation, animations |
| Font Awesome 4.4.0 | Social icons |
| Roboto Mono (Google Fonts) | Typography |
| normalize.css | CSS reset |
| next.js (custom) | Reveal animations, typing effect |

### Icon Usage

```html
<i class="fa fa-suitcase"></i>
<i class="fa fa-github"></i>
<i class="fa fa-code"></i>
<i class="fa fa-linkedin"></i>
<i class="fa fa-twitter"></i>
```

Font Awesome icons paired with action verbs.

### CSS Helper Classes

```css
.mt1 { margin-top: 5px; }
.mt2 { margin-top: 10px; }
.mb1 { margin-bottom: 5px; }
.mb2 { margin-bottom: 10px; }
.ml1 { margin-left: 5px; }
.ml2 { margin-left: 10px; }
.mr1 { margin-right: 5px; }
.mr2 { margin-right: 10px; }
```

Utility classes for spacing.

---

## 11. Design Patterns to Steal

### 1. Terminal Green on Black

```css
body {
  background-color: #000;
  color: #7FF709;
}
```

Instant recognition as "developer/hacker" aesthetic.

### 2. Prompt Prefix Pattern

```html
<p>> Your content here</p>
```

Simple `>` prefix makes any text feel like terminal output.

### 3. Flat Typography Hierarchy

```css
h1, h2, p {
  font-size: 1em;
}
```

All text same size - content speaks for itself.

### 4. Action-Verb Links

```html
I <a>write</a> <a>code</a> <a>build</a> <a>network</a>
```

Links are verbs, not destinations.

### 5. Blue Hover Highlight

```css
a:hover {
  background-color: #268bd2;
}
```

Strong, visible hover state.

### 6. Progressive Disclosure

```css
#section { display: none; }
```

```javascript
$('.learn').click(() => $('#section').fadeIn());
```

Content reveals on interaction.

### 7. Decorative Input Field

```css
#term-prompt {
  background-color: #000;
  border: none;
  color: #7FF709;
  outline: none;
}
```

Looks like terminal input, but purely aesthetic.

### 8. Indented Subresults

```css
.subresult {
  padding-left: 10%;
}
```

Simulates command output indentation.

### 9. Icon + Verb Pairing

```html
<li><i class="fa fa-github"></i> <a href="...">build</a></li>
```

Icon provides context, verb provides action.

### 10. Monospace-Only Design

```css
font-family: "Roboto Mono", monospace;
```

Commitment to single font family throughout.

---

## Comparison: Codebyte vs Saloni Garg

| Aspect | Codebyte.re | Saloni Garg |
|--------|-------------|-------------|
| Functionality | Full working CLI | Styled static page |
| Commands | `ls`, `cd`, `cat`, etc. | None (decorative) |
| Navigation | Via terminal commands | Click-based reveal |
| Complexity | High (shell class, history) | Low (jQuery fadeIn) |
| Colors | Multi-color (pink, cyan, green) | Two-color (green, blue) |
| Window Chrome | macOS buttons | None |
| Responsive | Yes (breakpoint) | Limited |

### When to Use Each Approach

**Codebyte style:**

- Developer portfolio for technical audience
- You want users to explore/discover
- You have time to implement full CLI

**Saloni Garg style:**

- Quick bio/landing page
- Terminal aesthetic without complexity
- Content should be immediately accessible

---

## How This Applies to nobhad.codes

Your site could incorporate:

1. **Prompt prefix (`>`)** for certain terminal-themed sections
2. **Green on black** as an alternate theme option
3. **Action-verb links** pattern for portfolio projects
4. **Progressive disclosure** for "about" or "skills" sections
5. **Decorative terminal input** at bottom of terminal sections

---

## File Reference

| File | Contents |
|------|----------|
| `saloni-garg` | HTML structure |
| `saloni-garg-style.css` | All custom styles |
| `saloni-garg-normalize.css` | CSS reset (standard) |
