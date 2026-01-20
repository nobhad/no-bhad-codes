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

### Terminal Intake (`terminal-intake.ts`)

Terminal-style intake form with conversational UI:

- **Chat interface**: Question-and-answer format
- **Click to edit**: Revise previous answers
- **Arrow navigation**: Press Up to go back
- **Review summary**: See all answers before submission
- **Conditional questions**: Dynamic flow based on answers
- **Session persistence**: Resume interrupted sessions

## File Structure

```text
src/features/client/
├── client-portal.ts          # Main portal dashboard (~1,400 lines)
├── terminal-intake.ts        # Terminal-style intake (~1,700 lines)
├── terminal-intake-types.ts  # Type definitions (~50 lines)
├── terminal-intake-data.ts   # Questions and options (~300 lines)
├── terminal-intake-ui.ts     # UI utilities (~600 lines)
├── terminal-intake-commands.ts # Terminal commands (~150 lines)
├── portal-types.ts           # Portal type definitions
└── README.md                 # This file

src/features/client/modules/  # Extracted modules (7 modules)
├── portal-auth.ts            # Login, logout, session (~310 lines)
├── portal-files.ts           # File management (~400 lines)
├── portal-invoices.ts        # Invoice display (~210 lines)
├── portal-messages.ts        # Messaging (~270 lines)
├── portal-navigation.ts      # Navigation, views, sidebar (~360 lines)
├── portal-projects.ts        # Project loading, display (~310 lines)
├── portal-settings.ts        # Settings forms (~260 lines)
└── index.ts                  # Module exports
```

## Entry Points

| Module | HTML Entry | URL |
|--------|-----------|-----|
| Client Portal | `client/portal.html` | `/client/portal.html` |
| Terminal Intake | `client/intake.html` | `/client/intake.html` |
| Intake Modal | `index.html` | `/` (via modal) |

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
- **Intake Submission**: `/api/intake`

## Related Documentation

- [Client Portal Feature](../../../docs/features/CLIENT_PORTAL.md)
- [Terminal Intake Feature](../../../docs/features/TERMINAL_INTAKE.md)
- [Messages Feature](../../../docs/features/MESSAGES.md)
- [Files Feature](../../../docs/features/FILES.md)
- [Invoices Feature](../../../docs/features/INVOICES.md)
- [Settings Feature](../../../docs/features/SETTINGS.md)
- [New Project Feature](../../../docs/features/NEW_PROJECT.md)

## Architecture Notes

### Module Refactor (Completed January 2026)

The `client-portal.ts` module was refactored from ~2,300 lines to ~1,400 lines by extracting 7 specialized modules:

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `portal-auth.ts` | ~310 | Login, logout, session management |
| `portal-files.ts` | ~400 | File upload, download, management |
| `portal-invoices.ts` | ~210 | Invoice display and download |
| `portal-messages.ts` | ~270 | Messaging with cache busting |
| `portal-navigation.ts` | ~360 | Navigation, views, sidebar |
| `portal-projects.ts` | ~310 | Project loading and display |
| `portal-settings.ts` | ~260 | Settings forms |

### Terminal Intake

`TerminalIntakeModule` does not extend `BaseModule` like other modules due to its unique conversational UI requirements.
