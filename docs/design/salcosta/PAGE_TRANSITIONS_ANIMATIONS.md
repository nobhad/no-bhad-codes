# Sal Costa - Page Transitions & Animations

**Complete element-by-element breakdown with exact timing and movement directions**

---

## HOME PAGE

### ENTRY ANIMATIONS

---

**ELEMENT: Name Letters "SAL COSTA"**

7 individual SVG block letters that spell out the name.

- **Starting State:** Each letter is positioned 105% above its final position (completely hidden above the viewport)
- **Animation:** Letters drop DOWN into view
- **Ending State:** Letters rest at their natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.8 seconds per letter
- **Easing:** `cubic-bezier(1, .2, .8, 0)` - starts fast, settles gently
- **Stagger Pattern:**
  - Letter S: starts at 0ms
  - Letter A: starts at 75ms
  - Letter L: starts at 75ms
  - Letter C: starts at 150ms
  - Letter O: starts at 150ms
  - Letter S: starts at 100ms
  - Letter T: starts at 150ms
  - Letter A: starts at 200ms
- **Total Sequence:** ~1 second for all letters to finish dropping in

---

**ELEMENT: Navigation Links (Work, About, Contact)**

3 text links positioned below the name.

- **Starting State:** Links are positioned 105% above their final position (hidden above)
- **Animation:** Links drop DOWN into view simultaneously
- **Ending State:** Links rest at their natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 1.0 seconds (waits for name letters to finish)
- **Easing:** `cubic-bezier(.3, .9, .3, .9)` - smooth with gentle settle

---

**ELEMENT: Scroll Roles Marquee**

Horizontal scrolling text at bottom of screen showing job titles ("Frontend Developer", "UX Designer", etc.) separated by bullet points.

- **Starting State:** Completely invisible with 8px blur applied
- **Animation:** Fades into view while blur clears (no directional movement)
- **Ending State:** Fully visible and sharp
- **Transform:** `opacity: 0` + `filter: blur(8px)` → `opacity: 1` + `filter: blur(0)`
- **Duration:** 0.5 seconds
- **Delay:** 1.5 seconds
- **Continuous Animation:** Once visible, text scrolls LEFT continuously at 14 seconds per complete cycle

---

**ELEMENT: Lava Lamp Background Blob**

Large coral/purple gradient circle in the background.

- **Position:** Centered on screen `translate(0)`
- **Size:** 260px diameter
- **Continuous Animation:** "Breathes" - moves diagonally 10px in each direction over 8 seconds, loops infinitely

---

### EXIT ANIMATIONS

---

**ELEMENT: Name Letters "SAL COSTA"**

- **Starting State:** Letters at their natural resting position
- **Animation:** Letters continue dropping DOWN and fall out of view
- **Ending State:** Letters are 105% below their starting position (hidden below)
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.2 seconds (much faster than entry)
- **Delay:** 0ms (immediate, no waiting)
- **Easing:** `ease-in` - accelerates as it falls

---

**ELEMENT: Navigation Links**

- **Starting State:** Links at their natural position
- **Animation:** Links drop DOWN and fall out of view
- **Ending State:** Links are hidden below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Scroll Roles Marquee**

- **Starting State:** Fully visible and sharp
- **Animation:** Fades out while blur is applied
- **Ending State:** Completely invisible with blur
- **Transform:** `opacity: 1` + `filter: blur(0)` → `opacity: 0` + `filter: blur(8px)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

## WORK PAGE

### ENTRY ANIMATIONS

---

**ELEMENT: Page Heading "Work"**

Large h1 text displaying the word "Work".

- **Starting State:** Text is positioned 110% above its final position (hidden above)
- **Animation:** Text drops DOWN into view
- **Ending State:** Text rests at natural position
- **Transform:** `translateY(-110%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.4 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Heading Divider (Horizontal Rule)**

4px thick horizontal line below the heading.

- **Starting State:** Line has zero width (scaled to 0 horizontally)
- **Animation:** Line GROWS from left edge toward right
- **Ending State:** Line is full width
- **Transform:** `scaleX(0)` → `scaleX(1)`
- **Transform Origin:** `bottom left` - grows from the left edge
- **Duration:** 0.8 seconds
- **Delay:** 0.4 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Project Card 1 (First Project)**

Full-width horizontal card with project title on left, category label on right, and bottom border.

- **Starting State:** Card is positioned 105% above its final position (hidden above)
- **Animation:** Card drops DOWN into view
- **Ending State:** Card rests at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.5 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Project Card 2**

- **Starting State:** Hidden 105% above
- **Animation:** Drops DOWN into view
- **Ending State:** Natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.6 seconds (100ms after Card 1)

---

**ELEMENT: Project Card 3**

- **Starting State:** Hidden 105% above
- **Animation:** Drops DOWN into view
- **Ending State:** Natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.7 seconds (100ms after Card 2)

---

**ELEMENT: Project Card 4**

- **Starting State:** Hidden 105% above
- **Animation:** Drops DOWN into view
- **Ending State:** Natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.8 seconds (100ms after Card 3)

---

**ELEMENT: Project Card 5**

- **Starting State:** Hidden 105% above
- **Animation:** Drops DOWN into view
- **Ending State:** Natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.9 seconds (100ms after Card 4)

---

**ELEMENT: Lava Lamp Background**

- **Starting Position:** Previous page position (centered if coming from Home)
- **Animation:** Blob slides to the RIGHT and slightly DOWN
- **Ending Position:** `translate(25%, 10%)` - positioned in right portion of screen
- **Size Change:** Shrinks from 260px to 180px diameter
- **Duration:** 0.8 seconds
- **Easing:** `ease-in-out`

---

### EXIT ANIMATIONS

---

**ELEMENT: Page Heading "Work"**

- **Starting State:** Text at natural position
- **Animation:** Text drops DOWN and falls out of view
- **Ending State:** Text is hidden 105% below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms (immediate)

---

**ELEMENT: Heading Divider**

- **Starting State:** Line is full width
- **Animation:** Line SHRINKS from right edge back toward left
- **Ending State:** Line has zero width
- **Transform:** `scaleX(1)` → `scaleX(0)`
- **Transform Origin:** `bottom left` - shrinks back to left edge
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Project Card 1**

- **Starting State:** Card at natural position
- **Animation:** Card drops DOWN and falls out of view
- **Ending State:** Card hidden below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0.1 seconds

---

**ELEMENT: Project Card 2**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.15 seconds (50ms after Card 1 - tighter stagger than entry)

---

**ELEMENT: Project Card 3**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.2 seconds

---

**ELEMENT: Project Card 4**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.25 seconds

---

**ELEMENT: Project Card 5**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.3 seconds

---

## WORK DETAIL PAGE (Individual Project)

### ENTRY ANIMATIONS

---

**ELEMENT: Hero Image**

Large project screenshot or mockup image at the top of the page.

- **Starting State:** Image is positioned 30% above its final position AND invisible
- **Animation:** Image slides DOWN while fading in
- **Ending State:** Image at natural position, fully visible
- **Transform:** `translateY(-30%)` + `opacity: 0` → `translateY(0)` + `opacity: 1`
- **Duration:** 0.8 seconds
- **Delay:** 0.4 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Intro Content Section**

Contains the project title, description paragraph, and metadata labels (Role, Year, Technologies).

- **Starting State:** Section is positioned 100px below its final position AND invisible
- **Animation:** Section slides UP while fading in
- **Ending State:** Section at natural position, fully visible
- **Transform:** `translateY(100px)` + `opacity: 0` → `translateY(0)` + `opacity: 1`
- **Duration:** 0.8 seconds
- **Delay:** 0.6 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Info Sections (Body Content)**

All content sections below the intro divider - includes images, videos, and text descriptions.

- **Starting State:** All sections positioned 100px below final position AND invisible
- **Animation:** Sections slide UP while fading in (as a group)
- **Ending State:** Sections at natural position, fully visible
- **Transform:** `translateY(100px)` + `opacity: 0` → `translateY(0)` + `opacity: 1`
- **Duration:** 0.8 seconds
- **Delay:** 0.8 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Back Button (Desktop Only)**

Large circular button with left-pointing arrow, fixed on left side of screen.

- **Starting State:** Button is positioned 170% to the LEFT of its final position (completely off-screen left)
- **Animation:** Button slides in from the LEFT
- **Ending State:** Button visible on left edge, vertically centered
- **Transform:** `translate(-170%, -50%)` → `translateY(-50%)`
- **Duration:** 0.8 seconds
- **Delay:** 1.2 seconds (comes in last)

---

**ELEMENT: Lava Lamp Background**

- **Starting Position:** Previous page position
- **Animation:** Blob slides to the FAR RIGHT and UP
- **Ending Position:** `translate(48%, -20%)` - positioned in upper right
- **Size Change:** Shrinks to 160px diameter
- **Duration:** 0.8 seconds
- **Easing:** `ease-in-out`

---

### EXIT ANIMATIONS

---

**ELEMENT: Hero Image**

- **Starting State:** Image at natural position, fully visible
- **Animation:** Image slides UP and accelerates out of view while fading
- **Ending State:** Image is 60% above starting position AND invisible
- **Transform:** `translateY(0)` + `opacity: 1` → `translateY(-60%)` + `opacity: 0`
- **Duration:** 0.5 seconds
- **Delay:** 0ms
- **Note:** Exit moves UP (opposite of entry direction for hero specifically)

---

**ELEMENT: Intro Content Section**

- **Starting State:** Section at natural position, fully visible
- **Animation:** Section slides DOWN while fading out
- **Ending State:** Section is 100px below AND invisible
- **Transform:** `translateY(0)` + `opacity: 1` → `translateY(100px)` + `opacity: 0`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Info Sections**

- **Starting State:** Sections at natural position, fully visible
- **Animation:** Sections slide DOWN while fading out
- **Ending State:** Sections 100px below AND invisible
- **Transform:** `translateY(0)` + `opacity: 1` → `translateY(100px)` + `opacity: 0`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Back Button**

- **Starting State:** Button visible on left edge
- **Animation:** Button slides out to the LEFT
- **Ending State:** Button is 170% to the left (off-screen)
- **Transform:** `translateY(-50%)` → `translate(-170%, -50%)`
- **Duration:** 0.8 seconds
- **Delay:** 0ms

---

## ABOUT PAGE

### ENTRY ANIMATIONS

---

**ELEMENT: Page Heading "About"**

Large h1 text displaying "About".

- **Starting State:** Text positioned 110% above final position (hidden above)
- **Animation:** Text drops DOWN into view
- **Ending State:** Text at natural position
- **Transform:** `translateY(-110%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.4 seconds
- **Easing:** `cubic-bezier(.3, .9, .3, .9)`

---

**ELEMENT: Heading Divider**

Horizontal rule below the heading.

- **Starting State:** Line has zero width
- **Animation:** Line GROWS from left edge toward right
- **Ending State:** Line is full width
- **Transform:** `scaleX(0)` → `scaleX(1)`
- **Transform Origin:** `bottom left`
- **Duration:** 0.8 seconds
- **Delay:** 0.4 seconds

---

**ELEMENT: First Paragraph**

Bio text - first paragraph of about content.

- **Starting State:** Paragraph positioned 105% above final position (hidden)
- **Animation:** Paragraph drops DOWN into view
- **Ending State:** Paragraph at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.8 seconds
- **Delay:** 0.5 seconds

---

**ELEMENT: Second Paragraph**

Bio text - second paragraph of about content.

- **Starting State:** Paragraph positioned 105% above (hidden)
- **Animation:** Paragraph drops DOWN into view
- **Ending State:** Paragraph at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.8 seconds
- **Delay:** 0.6 seconds (100ms after first paragraph)

---

**ELEMENT: About Photo**

Profile photo on the right side of the content.

- **Starting State:** Photo invisible with 8px blur applied
- **Animation:** Photo fades in while blur clears (no directional movement)
- **Ending State:** Photo fully visible and sharp
- **Transform:** `opacity: 0` + `filter: blur(8px)` → `opacity: 1` + `filter: blur(0)`
- **Duration:** 0.8 seconds
- **Delay:** 0.6 seconds

---

**ELEMENT: About Link**

Text link below paragraphs (links to resume or contact).

- **Starting State:** Link positioned 105% above (hidden)
- **Animation:** Link drops DOWN into view
- **Ending State:** Link at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.8 seconds
- **Delay:** 0.7 seconds

---

**ELEMENT: Lava Lamp Background**

- **Starting Position:** Previous page position
- **Animation:** Blob slides DOWN to bottom half of screen
- **Ending Position:** `translateY(50%)` - positioned in lower portion
- **Size:** Returns to 260px diameter (if was smaller on previous page)
- **Duration:** 0.8 seconds

---

### EXIT ANIMATIONS

---

**ELEMENT: Page Heading "About"**

- **Starting State:** Text at natural position
- **Animation:** Text drops DOWN and falls out of view
- **Ending State:** Text hidden 105% below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Heading Divider**

- **Starting State:** Line at full width
- **Animation:** Line SHRINKS from right back toward left
- **Ending State:** Line has zero width
- **Transform:** `scaleX(1)` → `scaleX(0)`
- **Transform Origin:** `bottom left`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: First Paragraph**

- **Starting State:** Paragraph at natural position
- **Animation:** Paragraph drops DOWN out of view
- **Ending State:** Paragraph hidden below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0.1 seconds

---

**ELEMENT: Second Paragraph**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.15 seconds

---

**ELEMENT: About Photo**

- **Starting State:** Photo fully visible and sharp
- **Animation:** Photo fades out while blur is applied
- **Ending State:** Photo invisible with blur
- **Transform:** `opacity: 1` + `filter: blur(0)` → `opacity: 0` + `filter: blur(8px)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: About Link**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.2 seconds

---

## CONTACT PAGE

### ENTRY ANIMATIONS

---

**ELEMENT: Page Heading "Contact"**

Large h1 text displaying "Contact".

- **Starting State:** Text positioned 110% above (hidden)
- **Animation:** Text drops DOWN into view
- **Ending State:** Text at natural position
- **Transform:** `translateY(-110%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.4 seconds

---

**ELEMENT: Heading Divider**

Horizontal rule below heading.

- **Starting State:** Line has zero width
- **Animation:** Line GROWS from left edge toward right
- **Ending State:** Line at full width
- **Transform:** `scaleX(0)` → `scaleX(1)`
- **Transform Origin:** `bottom left`
- **Duration:** 0.8 seconds
- **Delay:** 0.4 seconds

---

**ELEMENT: Name Input Field**

Text input field for visitor's name.

- **Starting State:** Input positioned 105% above (hidden)
- **Animation:** Input drops DOWN into view
- **Ending State:** Input at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.5 seconds

---

**ELEMENT: Email Input Field**

Text input field for visitor's email.

- **Starting State:** Input positioned 105% above (hidden)
- **Animation:** Input drops DOWN into view
- **Ending State:** Input at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.6 seconds

---

**ELEMENT: Subject Input Field**

Text input field for message subject.

- **Starting State:** Input positioned 105% above (hidden)
- **Animation:** Input drops DOWN into view
- **Ending State:** Input at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.7 seconds

---

**ELEMENT: Message Textarea**

Multi-line text area for the message body.

- **Starting State:** Textarea positioned 105% above (hidden)
- **Animation:** Textarea drops DOWN into view
- **Ending State:** Textarea at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.8 seconds

---

**ELEMENT: Submit Button**

Large circular button with right-pointing arrow, positioned on the right side.

- **Starting State:** Button is positioned 800px to the RIGHT (completely off-screen) AND invisible
- **Animation:** Button slides in from the RIGHT while fading in
- **Ending State:** Button at final position, fully visible
- **Transform:** `translate(800px)` + `opacity: 0` → `translate(0)` + `opacity: 1`
- **Duration:** 0.8 seconds
- **Delay:** 0.8 seconds

---

**ELEMENT: Email Box**

Alternative contact section showing "Or email me at..." with email link.

- **Starting State:** Box invisible with 8px blur
- **Animation:** Box fades in while blur clears
- **Ending State:** Box fully visible and sharp
- **Transform:** `opacity: 0` + `filter: blur(8px)` → `opacity: 1` + `filter: blur(0)`
- **Duration:** 0.5 seconds
- **Delay:** 1.2 seconds (comes in last)

---

**ELEMENT: Lava Lamp Background**

- **Starting Position:** Previous page position
- **Animation:** Blob slides to the LEFT and DOWN
- **Ending Position:** `translate(-35%, 30%)` - positioned in lower left
- **Size Change:** Shrinks to 120px diameter (smallest on any page)
- **Duration:** 0.8 seconds

---

### EXIT ANIMATIONS

---

**ELEMENT: Page Heading "Contact"**

- **Starting State:** Text at natural position
- **Animation:** Text drops DOWN out of view
- **Ending State:** Text hidden below
- **Transform:** `translateY(0)` → `translateY(105%)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Heading Divider**

- **Starting State:** Line at full width
- **Animation:** Line SHRINKS back toward left edge
- **Ending State:** Line has zero width
- **Transform:** `scaleX(1)` → `scaleX(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Name Input Field**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.1 seconds

---

**ELEMENT: Email Input Field**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.15 seconds

---

**ELEMENT: Subject Input Field**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.2 seconds

---

**ELEMENT: Message Textarea**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.25 seconds

---

**ELEMENT: Submit Button**

- **Starting State:** Button at final position, fully visible
- **Animation:** Button slides out to the RIGHT while fading
- **Ending State:** Button is 800px to the right AND invisible
- **Transform:** `translate(0)` + `opacity: 1` → `translate(800px)` + `opacity: 0`
- **Duration:** 0.8 seconds
- **Delay:** 0ms

---

**ELEMENT: Email Box**

- **Starting State:** Box fully visible
- **Animation:** Box fades out with blur
- **Ending State:** Box invisible with blur
- **Transform:** `opacity: 1` + `filter: blur(0)` → `opacity: 0` + `filter: blur(8px)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

## 404 PAGE

### ENTRY ANIMATIONS

---

**ELEMENT: Error Number "404"**

Giant text displaying "404".

- **Starting State:** Text positioned 110% above (hidden)
- **Animation:** Text drops DOWN into view
- **Ending State:** Text at natural position
- **Transform:** `translateY(-110%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.4 seconds
- **Font Size:** 14rem (224px) on desktop, 8rem (128px) on mobile

---

**ELEMENT: Heading Divider**

Horizontal rule below the 404.

- **Starting State:** Line has zero width
- **Animation:** Line GROWS from left toward right
- **Ending State:** Line at full width
- **Transform:** `scaleX(0)` → `scaleX(1)`
- **Transform Origin:** `bottom left`
- **Duration:** 0.8 seconds
- **Delay:** 0.4 seconds

---

**ELEMENT: Error Message Content**

Text explaining the page wasn't found, plus link back to home.

- **Starting State:** Content positioned 105% above (hidden)
- **Animation:** Content drops DOWN into view
- **Ending State:** Content at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.5 seconds

---

**ELEMENT: Lava Lamp Background**

- **Starting Position:** Previous page position
- **Animation:** Blob slides DOWN to bottom half
- **Ending Position:** `translateY(50%)`
- **Size:** 260px diameter
- **Duration:** 0.8 seconds

---

### EXIT ANIMATIONS

---

**ELEMENT: Error Number "404"**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Heading Divider**

- **Animation:** SHRINKS back toward left edge
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Error Message Content**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.5 seconds
- **Delay:** 0.1 seconds

---

## NAVIGATION MENU OVERLAY

### OPEN (Menu Opening)

---

**ELEMENT: Overlay Background**

Full-screen semi-transparent backdrop that covers the page.

- **Starting State:** Completely invisible, no blur
- **Animation:** Fades in while backdrop blur increases
- **Ending State:** 70% opacity background with 8px backdrop blur
- **Transform:** `opacity: 0` + `backdrop-filter: blur(0)` → `opacity: 1` + `backdrop-filter: blur(8px)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms (immediate)

---

**ELEMENT: Nav Link 1 (Work)**

Large text link for "Work".

- **Starting State:** Link positioned 105% above (hidden)
- **Animation:** Link drops DOWN into view
- **Ending State:** Link at natural position
- **Transform:** `translateY(-105%)` → `translateY(0)`
- **Duration:** 0.5 seconds
- **Delay:** 0.2 seconds

---

**ELEMENT: Nav Link 2 (About)**

Large text link for "About".

- **Animation:** Drops DOWN into view
- **Duration:** 0.5 seconds
- **Delay:** 0.3 seconds

---

**ELEMENT: Nav Link 3 (Contact)**

Large text link for "Contact".

- **Animation:** Drops DOWN into view
- **Duration:** 0.5 seconds
- **Delay:** 0.4 seconds

---

**ELEMENT: Nav Link 4 (Home)**

Large text link for "Home".

- **Animation:** Drops DOWN into view
- **Duration:** 0.5 seconds
- **Delay:** 0.5 seconds

---

**ELEMENT: Footer Details**

Social media icons and copyright text at bottom of menu.

- **Starting State:** Invisible with 8px blur
- **Animation:** Fades in while blur clears
- **Ending State:** Fully visible and sharp
- **Transform:** `opacity: 0` + `filter: blur(8px)` → `opacity: 1` + `filter: blur(0)`
- **Duration:** 0.8 seconds
- **Delay:** 0.8 seconds

---

### CLOSE (Menu Closing)

---

**ELEMENT: Nav Link 1**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.2 seconds (faster than entry)
- **Delay:** 0.1 seconds

---

**ELEMENT: Nav Link 2**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.2 seconds
- **Delay:** 0.15 seconds

---

**ELEMENT: Nav Link 3**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.2 seconds
- **Delay:** 0.2 seconds

---

**ELEMENT: Nav Link 4**

- **Animation:** Drops DOWN out of view
- **Duration:** 0.2 seconds
- **Delay:** 0.25 seconds

---

**ELEMENT: Footer Details**

- **Animation:** Fades out with blur (instant)
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

**ELEMENT: Overlay Background**

- **Animation:** Fades out, blur decreases
- **Duration:** 0.5 seconds
- **Delay:** 0.2 seconds (waits for links to start exiting)

---

## AWWWARDS BADGE

### ENTRY

**ELEMENT: Awwwards Badge**

Vertical badge fixed to right edge of screen.

- **Starting State:** Badge positioned 60px to the RIGHT (off-screen)
- **Animation:** Badge slides in from RIGHT
- **Ending State:** Badge visible on right edge
- **Transform:** `translate(60px, -50%)` → `translateY(-50%)`
- **Duration:** 0.5 seconds
- **Delay:** 1.2 seconds

---

### EXIT

- **Starting State:** Badge visible on right edge
- **Animation:** Badge slides out to RIGHT
- **Ending State:** Badge 60px off-screen to the right
- **Transform:** `translateY(-50%)` → `translate(60px, -50%)`
- **Duration:** 0.5 seconds
- **Delay:** 0ms

---

## LAVA LAMP POSITION REFERENCE

| Page | Position | Blob Size |
|------|----------|-----------|
| Home | `translate(0)` (centered) | 260px |
| Work | `translate(25%, 10%)` (right, slightly down) | 180px |
| Work Detail | `translate(48%, -20%)` (far right, up) | 160px |
| About | `translateY(50%)` (bottom half) | 260px |
| Contact | `translate(-35%, 30%)` (left, down) | 120px |
| 404 | `translateY(50%)` (bottom half) | 260px |

**Transition between any positions:** 0.8 seconds with `ease-in-out` easing
