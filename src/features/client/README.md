# Client Features

Client-facing features for the portal, intake forms, and authentication.

## Modules

### Client Portal (`client-portal.ts`)

The main client dashboard module providing:

- **Dashboard**: Overview with project stats and recent activity
- **Messages**: Real-time messaging with admin
- **Files**: File upload, download, and management
- **Invoices**: Invoice viewing, download, and payment status
- **Settings**: Profile, password, notifications, and billing
- **New Project**: Submit new project requests

### Client Intake (`client-intake.ts`)

Progressive intake form for new client onboarding:

- **Multi-step form**: Project type, budget, timeline
- **Auto-save**: Saves progress to localStorage
- **GSAP animations**: Smooth section transitions
- **Validation**: Real-time field validation

### Terminal Intake (`terminal-intake.ts`)

Terminal-style intake form with conversational UI:

- **Chat interface**: Question-and-answer format
- **Click to edit**: Revise previous answers
- **Arrow navigation**: Press Up to go back
- **Review summary**: See all answers before submission
- **Conditional questions**: Dynamic flow based on answers

## File Structure

```text
src/features/client/
├── client-portal.ts      # Main portal dashboard (~3,000 lines)
├── client-intake.ts      # Progressive intake form (~640 lines)
├── terminal-intake.ts    # Terminal-style intake (~2,500 lines)
└── README.md             # This file
```

## Entry Points

| Module | HTML Entry | URL |
|--------|-----------|-----|
| Client Portal | `client/portal.html` | `/client/portal.html` |
| Client Intake | `client/intake.html` | `/client/intake.html` |
| Terminal Intake | `client/intake.html` | `/client/intake.html` (modal) |

## Development

### Running Locally

```bash
npm run dev:full
# Navigate to http://localhost:4000/client/portal.html
```

### Authentication

Client portal requires JWT authentication:

1. Login via `/api/auth/login` endpoint
2. Token stored in `localStorage`
3. Demo mode available for testing

### Demo Credentials

```text
Email: demo@example.com
Password: demo123
```

## Integration Points

- **Backend API**: `/api/clients/*`, `/api/projects/*`, `/api/messages/*`
- **File Uploads**: `/api/uploads/*`
- **Authentication**: `/api/auth/*`
- **Invoices**: `/api/invoices/*`

## Related Documentation

- [Client Portal Feature](../../../docs/features/CLIENT_PORTAL.md)
- [Messages Feature](../../../docs/features/MESSAGES.md)
- [Files Feature](../../../docs/features/FILES.md)
- [Invoices Feature](../../../docs/features/INVOICES.md)
- [Settings Feature](../../../docs/features/SETTINGS.md)
- [New Project Feature](../../../docs/features/NEW_PROJECT.md)

## Known Issues

### File Size

The modules in this directory exceed the 300-line guideline:

| File | Lines | Status |
|------|-------|--------|
| `client-portal.ts` | ~3,000 | Needs splitting |
| `terminal-intake.ts` | ~2,500 | Needs splitting |
| `client-intake.ts` | ~640 | Needs splitting |

**Planned refactor**: Split into smaller modules by concern (messaging, files, invoices, etc.)

### Inheritance

`TerminalIntakeModule` does not extend `BaseModule` like other modules. This should be addressed for consistency.
