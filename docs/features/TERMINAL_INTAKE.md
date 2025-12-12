# Terminal Intake Form

**Status:** Complete
**Last Updated:** 2025-12-12

## Overview

The Terminal Intake Form is an AI chat-style project intake system that collects client information through a conversational terminal interface. It provides a unique, engaging experience that feels like chatting with an AI assistant.

## Architecture

### Components

- `src/features/client/terminal-intake.ts` - Main module (~1,450 lines)
- `src/features/client/terminal-intake-types.ts` - TypeScript interfaces (~50 lines)
- `src/features/client/terminal-intake-data.ts` - Question definitions (~470 lines)
- `src/features/client/terminal-intake-ui.ts` - UI utilities and rendering (~500 lines)
- `src/styles/pages/terminal-intake.css` - Terminal styling

### Key Interfaces

```typescript
interface IntakeQuestion {
  id: string;
  field: string;
  question: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'select' | 'multiselect' | 'textarea';
  options?: { value: string; label: string }[];
  required: boolean;
  validation?: (value: string) => string | null;
  dependsOn?: { field: string; value: string | string[] };
  placeholder?: string;
}

interface IntakeData {
  [key: string]: string | string[];
}

interface ChatMessage {
  type: 'ai' | 'user' | 'system' | 'error' | 'success';
  content: string;
  options?: { value: string; label: string }[];
  multiSelect?: boolean;
  questionIndex?: number;
}
```

## Features

### Conversational Flow

Questions are asked sequentially with typing animation:

1. **Greeting** - Asks for name
2. **Email** - With validation
3. **Company** - Optional based on "Is this for a company?" question
4. **Phone** - With US phone validation
5. **Project Type** - Select from options
6. **Features** - Multi-select with custom option
7. **Budget** - Range selection
8. **Timeline** - Urgency selection
9. **Domain** - Has domain / needs advice
10. **Hosting** - Hosting preference
11. **Additional Info** - Textarea for details

### Conditional Questions

Questions can depend on previous answers:

```typescript
{
  id: 'domainName',
  field: 'domainName',
  question: "What's your domain name?",
  type: 'text',
  required: false,
  dependsOn: { field: 'hasDomain', value: 'yes' }
}
```

### Navigation

- **Click to Edit**: Click any previous answer to go back and edit
- **Arrow Up**: Press up arrow to go back one question
- **Review Summary**: All answers shown before final submission

### Validation

- Email format validation
- US phone number validation (10-11 digits)
- Rejects fake numbers (555-555-xxxx, all same digits, sequential)
- Custom validators per question

### Visual Effects

- Typing animation for AI messages
- Blinking cursor effect
- Smooth scroll to latest message
- GSAP-powered option button animations
- Terminal-style monospace font

## API Endpoints

### Submit Intake

```
POST /api/intake
Content-Type: application/json
Authorization: Bearer <token> (optional)

{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Inc",
  "phone": "555-123-4567",
  "projectType": "website",
  "features": ["responsive", "cms", "seo"],
  "budget": "5k-10k",
  "timeline": "1-month",
  "hasDomain": "yes",
  "domainName": "acme.com",
  "hosting": "managed",
  "additionalInfo": "Looking for a modern design..."
}
```

### Response

```json
{
  "success": true,
  "intake": {
    "id": "INT-2025-001",
    "projectType": "website"
  }
}
```

## Usage

### In Modal (Main Page)

The terminal intake opens in a modal when clicking "intake form" link:

```html
<a href="#" class="intake-modal-trigger">intake form</a>
```

### Standalone Page

Direct access at `/client/intake`:

```html
<div class="terminal-intake-container">
  <!-- Terminal content rendered by module -->
</div>
```

### Module Initialization

```typescript
import { TerminalIntakeModule } from './features/client/terminal-intake';

const intake = new TerminalIntakeModule();
await intake.init();
```

## Styling

### CSS Variables Used

```css
--color-terminal-bg: #0a0a0a;
--color-terminal-green: #00ff00;
--color-terminal-text: #ffffff;
--color-terminal-text-muted: #888888;
--color-terminal-border: #3d3d3d;
```

### Key CSS Classes

- `.terminal-container` - Main terminal wrapper
- `.terminal-header` - macOS-style window buttons
- `.terminal-output` - Chat message area
- `.terminal-input-area` - Input field container
- `.chat-message` - Individual message bubble
- `.option-button` - Select/multiselect option buttons
- `.clickable-message` - Editable previous answers

## Testing

Unit tests located at:

- `tests/unit/features/terminal-intake.test.ts` (if exists)

### Manual Testing

1. Open intake form modal on main page
2. Complete all questions
3. Verify validation errors appear for invalid inputs
4. Test click-to-edit navigation
5. Test arrow up navigation
6. Verify review summary shows all answers
7. Submit and verify success message

## Change Log

### 2025-12-03 - Initial Implementation

- Created conversational intake form
- Added typing animation
- Implemented question flow with dependencies
- Added click-to-edit navigation
- Added review summary before submission

### 2025-12-04 - Enhancements

- Added arrow key navigation
- Improved phone validation
- Added conditional company question
- Fixed multiselect edit loop bug

### 2025-12-12 - CSS Variable Cleanup

- Replaced 50+ hardcoded colors with CSS variables
- Added terminal-specific color tokens to variables.css
