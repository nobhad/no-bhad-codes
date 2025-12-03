# Current Work - December 3, 2025

---

## System Status

**Last Updated**: December 3, 2025

### Build Status

- **TypeScript**: 0 errors
- **ESLint**: 0 errors
- **Tests**: 259 passing (all tests pass)
- **Build**: Success

### Development Server

Run `npm run dev:full` to start both frontend and backend

**Development URLs:**
- Frontend: http://localhost:4000
- Backend API: http://localhost:4001
- API Docs: http://localhost:4001/api-docs

---

## Known Issues

### Mobile Business Card Positioning

**Status**: Open

**Issue**: On mobile devices, the business card appears too low in the viewport. After the flip animation, the card should remain at the same vertical position (centered in the viewport), but it starts lower than expected.

**Screenshots**:
- `/Users/noellebhaduri/Downloads/IMG_7C958FB92003-1.jpeg` - Shows glitching during flip
- `/Users/noellebhaduri/Downloads/IMG_4031.PNG` - Front of card (positioned low)
- `/Users/noellebhaduri/Downloads/IMG_4030.PNG` - Back of card (also positioned low)

**Expected Behavior**:
- Card should be vertically centered in the viewport
- Card position should remain consistent before and after flip animation

**Files Involved**:
- `src/styles/components/business-card.css` - Card dimensions and layout
- `src/styles/base/layout.css` - Section centering (uses `justify-content: center`)
- IntroModule (GSAP animations may affect positioning)

**Possible Causes**:
- Mobile header height affecting `calc(100vh - header - footer)` calculation
- GSAP animation not properly centering on mobile
- Section padding on mobile affecting centering
- Footer visibility or height on mobile

**Next Steps**:
- [ ] Inspect mobile section height calculation
- [ ] Check GSAP intro animation positioning on mobile
- [ ] Verify header/footer heights on mobile
- [ ] Consider using `align-items: center` with fixed positioning

---

### Redis Caching Disabled

**Status**: Deferred (not needed for development)

**Issue**: Redis connection errors when starting the server:
```
Redis connection closed
Failed to initialize cache service: Error: Connection is closed.
Redis error: AggregateError [ECONNREFUSED]
```

**Cause**: Redis is not installed/running locally. The cache service tries to connect to Redis on localhost:6379.

**Current Solution**:
- [x] Added `REDIS_ENABLED` environment variable check in `server/app.ts`
- [x] When `REDIS_ENABLED` is not set to `true`, Redis initialization is skipped entirely
- [x] Server runs without caching functionality (fine for development)

**To Enable Redis Later (Production):**
1. Install Redis: `brew install redis` (macOS)
2. Start Redis: `brew services start redis`
3. Add to `.env`: `REDIS_ENABLED=true`
4. Optionally configure: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

**Files Modified:**
- `server/app.ts` - Added REDIS_ENABLED check before cache initialization

---

### Port Configuration Changed

**Status**: Complete

**Issue**: Port conflict with another project running on localhost:3000/3001. Requests from other project were hitting this project's backend.

**Solution**: Changed all ports to 4000/4001:
- Frontend: 3000 → 4000
- Backend: 3001 → 4001

**Files Modified:**
- `vite.config.ts` - Frontend port and proxy targets
- `server/app.ts` - Backend port default
- `server/config/environment.ts` - Default PORT, FRONTEND_URL, API_BASE_URL
- `server/simple-auth-server.ts` - Port and CORS origins
- `server/test-server.ts` - Port
- `server/config/swagger.ts` - API docs URLs
- `src/config/api.ts` - Development API base URL
- `src/features/client/client-portal.ts` - Changed hardcoded URLs to relative paths (`/api/...`)
- `src/features/client/client-intake.ts` - Changed hardcoded URL to relative path
- `.env` - Created with PORT=4001, FRONTEND_URL=http://localhost:4000

---

### Footer Not Displaying on Main Page

**Status**: Fixed (v3) - VERIFIED WORKING

**Issue**: The footer element exists in the DOM but is not visible on the main home page. The footer has `position: fixed` and `bottom: 0` CSS but doesn't appear on screen.

**Root Cause Analysis (Deep Dive v2):**
- **Primary Cause**: The `index.html` starts with `class="intro-loading"` on the `<html>` element
- The CSS rule `.intro-loading .footer { opacity: 0 !important; visibility: hidden !important; }` hides the footer
- The `IntroAnimationModule` is supposed to remove `intro-loading` and add `intro-complete` when the intro finishes
- If the intro animation fails to initialize or complete, the class is never removed and the footer stays hidden

**Previous Fix (z-index):**
- [x] Changed z-index from 10 to 200 in `layout.css`
- [x] Changed z-index from 10 to 200 in `main.css` (both instances)
- [x] Changed z-index from 100 to 200 in `components/footer.css`

**Additional Fix (Intro Animation Failsafe):**
- [x] Added CSS animation fallback that shows footer after 3 seconds if JS fails
- [x] Added JavaScript failsafe in `main.ts` that forces class removal after 3 seconds
- [x] CSS `@keyframes intro-fallback-show` animation added to `layout.css`

**Final Fix (v3 - December 2, 2025):**
- [x] Removed footer from intro-loading CSS rules entirely (footer should always be visible)
- [x] Added `opacity: 1 !important; visibility: visible !important;` to `footer.css`
- [x] Footer is no longer hidden during intro animation

**Files Modified:**
- `src/styles/base/layout.css` - Removed `.footer` from intro-loading rules, added CSS fallback
- `src/styles/components/footer.css` - Added explicit visibility with !important
- `src/main.ts` - Added JavaScript failsafe timer
- `vite.config.js` - Updated port from 3000 to 4000 (this file was being used, not .ts)

---

### Client Landing Page Loading Unnecessary Modules

**Status**: Fixed

**Issue**: The client-landing page loads main page modules that don't exist on this page, causing console errors:
```
[BusinessCardRenderer] Required card elements not found
[contact-form] Required element "Contact form" with selector ".contact-form" not found
BusinessCardRenderer.enableAfterIntro: Cannot read properties of null (reading 'style')
```

**Root Cause**: The page type detection in `app.ts` only checked for `/client` AND `/portal`, so `/client/landing` was being treated as a main site page.

**Fix Applied:**
- [x] Added specific page type detection for `/client/landing` and `/client/intake`
- [x] Created dedicated module lists for each client page type:
  - `clientLandingModules`: ThemeModule, FooterModule
  - `clientIntakeModules`: ThemeModule, NavigationModule, FooterModule
  - `clientPortalModules`: ThemeModule, ClientPortalModule
- [x] Removed `ClientLandingModule` from main site modules (was causing errors)

**Files Modified:**
- `src/core/app.ts` - Updated page type detection and module lists

---

### Client Portal Sidebar Layout

**Status**: Fixed

**Issue**: Multiple sidebar layout issues - SIGN OUT button not at bottom, footer overlapping sidebar, collapsed state showing partial content.

**Fixes Applied:**
- [x] SIGN OUT button positioned at bottom using `position: absolute` on `.sidebar-footer`
- [x] Hide entire `.sidebar-content` when collapsed (prevents partial text showing)
- [x] Hide footer on client portal entirely (`display: none !important`) to avoid z-index conflicts
- [x] Dashboard container uses full `100vh` height instead of `calc(100vh - footer-height)`
- [x] Added small avatar logo at top of collapsed sidebar linking to home page
- [x] Sidebar buttons slightly larger with diffuse shadows
- [x] Added `handleLogout()` method to clear auth and redirect to landing page

**Files Modified:**
- `src/styles/pages/client-portal.css` - Sidebar and footer styles
- `src/features/client/client-portal.ts` - Added handleLogout method
- `client/portal.html` - Added collapsed avatar logo, btn-secondary class to logout button

---

### Intake Modal Missing Overlay

**Status**: Fixed

**Issue**: Client landing page intake modal was missing the dark overlay background when opened.

**Fixes Applied:**
- [x] Added `.intake-modal` CSS with dark overlay (`rgba(0, 0, 0, 0.8)`)
- [x] Fixed CSS to use `.open` class (not `.active`) to match JavaScript
- [x] Added minimized and fullscreen states for modal

**Files Modified:**
- `src/styles/pages/client.css` - Added intake-modal styles (lines 993-1041)

---

### Terminal Intake Dividing Line

**Status**: Fixed

**Issue**: Terminal intake form was missing the dividing line above the input text area.

**Fixes Applied:**
- [x] Changed `.terminal-input-area` border-top from `none` to `2px solid #000000`

**Files Modified:**
- `src/styles/pages/terminal-intake.css` - Added border-top to input area

---

### Persistent Login for Client Portal

**Status**: Fixed

**Issue**: User was being taken back to landing page even when already logged in. Session should persist unless user explicitly logs out.

**Fixes Applied:**
- [x] Added `isLoggedIn()` check in `ClientLandingModule.onInit()` to redirect to portal if already authenticated
- [x] Checks for `clientAuth` localStorage data with valid email and loginTime
- [x] Also checks for `client_auth_token` stored by portal
- [x] Updated `handleLogout()` in `ClientPortalModule` to clear all auth-related localStorage keys:
  - `clientAuth`
  - `clientAuthToken`
  - `client_auth_token`
  - `clientPortalAuth`
  - `clientEmail`
  - `clientName`

**Files Modified:**
- `src/features/client/client-landing.ts` - Added isLoggedIn() check and redirect
- `src/features/client/client-portal.ts` - Updated handleLogout() to clear all auth keys

---

### DataService Portfolio Load Error

**Status**: Known

**Issue**: Console error when loading main page:
```
[DataService] Failed to load portfolio data: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Cause**: The DataService is trying to fetch JSON data from a URL that returns HTML (likely a 404 page). This happens when the portfolio JSON endpoint doesn't exist or the server returns an HTML error page instead of JSON.

**Impact**: Navigation data fails to load, portfolio data unavailable

**Files Involved**:
- `src/services/data-service.ts` - Data service making the fetch request
- `src/core/app.ts` - Application initialization

**Next Steps**:
- [ ] Verify the portfolio JSON endpoint exists on the server
- [ ] Add proper 404 handling to return JSON error responses
- [ ] Add fallback data in DataService when fetch fails

---

## Completed Today

### Terminal Intake Form Enhancements

**Completed:** December 3, 2025

**Summary:** Major enhancements to the terminal intake form including security improvements, navigation features, and UX enhancements.

**Features Implemented:**

Global Input Sanitization:
- [x] Created `server/middleware/sanitization.ts` - comprehensive sanitization utilities
- [x] `sanitizeString()` - HTML entity encoding to prevent XSS
- [x] `sanitizeObject()` - recursive sanitization for nested objects/arrays
- [x] `sanitizeInputs()` - Express middleware for body, query, and params
- [x] `stripDangerousPatterns()` - aggressive sanitization for high-risk fields
- [x] Applied globally in `server/app.ts` after body parsing

Terminal Intake Navigation:
- [x] **Click to Edit**: Users can click on previous answers to go back and edit
- [x] Added `questionIndex` property to ChatMessage interface
- [x] Added `goBackToQuestion()` method to navigate to previous questions
- [x] Added CSS styles for `.clickable-message` with hover states
- [x] **Arrow Key Navigation**: Press Up Arrow to go back to previous question
- [x] Works when not actively typing in input field
- [x] Navigation removes subsequent messages and answers

Terminal Intake Review Summary:
- [x] Added `generateReviewSummary()` to format all answers for review
- [x] Added `showReviewAndConfirm()` to display review before submission
- [x] Added `waitForReviewConfirmation()` for yes/no confirmation
- [x] Added `waitForChangeDecision()` for restart/submit decision
- [x] User sees all answers before final submission

Additional Questions:
- [x] Added `customFeatures` text question with `dependsOn: { field: 'features', value: 'custom' }`
- [x] Added `hasDomain` select question (yes/no/needs-advice)
- [x] Added `domainName` text question (appears if hasDomain = yes)
- [x] Added `hosting` select question
- [x] Added `hostingProvider` text question (appears if hosting = have-hosting)
- [x] Fixed `dependsOn` logic to handle array values from multiselect fields

Other Fixes:
- [x] Fixed avatar static overlay to only cover SVG (not full container)
- [x] Removed Project ID and Client ID from success message
- [x] Fixed multiple lint errors in terminal-intake.ts

**Files Created:**

| File | Purpose |
|------|---------|
| `server/middleware/sanitization.ts` | Input sanitization middleware |

**Files Modified:**

| File | Changes |
|------|---------|
| `server/app.ts` | Added sanitizeInputs() middleware globally |
| `src/features/client/terminal-intake.ts` | Added navigation, review, new questions |
| `src/styles/pages/terminal-intake.css` | Click-to-edit hover styles, avatar wrapper |

**Security:**
- All incoming request body, query params, and URL params are now sanitized
- HTML entities encoded: `&`, `<`, `>`, `"`, `'`, `/`, `` ` ``, `=`
- Sensitive fields (password, tokens) are skipped during sanitization
- Dangerous patterns (script tags, javascript:, event handlers) can be stripped

**Navigation Features:**
- **Click**: Click any previous answer to edit it
- **Arrow Up**: Go back one question
- Both methods remove subsequent Q&A from the conversation

**Verification:**

- [x] TypeScript: 0 errors
- [x] ESLint: 0 errors
- [x] Build: Success

---

### Client Portal Mobile Responsiveness

**Completed:** December 2, 2025

**Summary:** Comprehensive mobile responsiveness improvements for the Client Portal, including hamburger navigation, mobile-optimized layouts, and touch-friendly interactions.

**Features Implemented:**

Mobile Navigation:
- [x] Fixed header bar with hamburger menu on mobile
- [x] Sidebar slides from right side with dark overlay
- [x] Close button inside sidebar when open
- [x] Page title updates dynamically when switching tabs

Dashboard:
- [x] Stack stat cards in single column on mobile
- [x] Move project status cards above quick stats section

Files Page:
- [x] Stack file items vertically on mobile
- [x] Hide drag/drop zone on mobile (tap doesn't work for drag/drop)
- [x] Show only Browse Files button for uploads
- [x] Trash icon only appears on client-uploaded files (admin files not deletable)
- [x] Updated demo files: Project-Outline.pdf (newest), My-Brand-Assets.zip, Intake-Summary.pdf (oldest)

Messages Page:
- [x] Hide emoji picker on mobile
- [x] Fix avatar positioning aligned with message bubbles
- [x] Extend message bubbles to edges of container
- [x] Chat area takes most of screen height and is scrollable
- [x] Enable demo message sending (temporary, resets on refresh)
- [x] Add unread message from admin in demo conversation

Client Landing Page:
- [x] Hide "Already have an account? Sign in..." text on mobile

**Files Modified:**

| File | Changes |
|------|---------|
| `server/app.ts` | Added terminal intake route |
| `src/features/client/client-portal.ts` | Mobile menu toggle, demo messaging, file permissions |
| `src/features/client/terminal-intake.ts` | New terminal-style intake form module |
| `src/styles/base/layout.css` | Mobile layout adjustments |
| `src/styles/pages/client-portal.css` | ~400 lines of mobile styles |
| `src/styles/pages/client.css` | Hide login description on mobile |
| `src/styles/pages/terminal-intake.css` | Terminal intake styles |
| `templates/pages/client-intake.ejs` | Updated for terminal intake |
| `templates/pages/client-landing.ejs` | Added login-description class |
| `templates/pages/client-portal.ejs` | Mobile header bar, sidebar overlay, updated demo data |

**Verification:**

- [x] TypeScript: 0 errors
- [x] ESLint: 0 errors
- [x] Build: Success

---

### Client Portal Landing Page - Two Card Layout

**Completed:** December 2, 2025

**Summary:** Created a new client portal landing page (`/client/landing`) with two cards - one for new client intake and one for existing client login.

**Features Implemented:**

- [x] Two-card layout (Intake and Login)
- [x] New Client card links to `/client/intake` for project intake form
- [x] Existing Client card with inline login form
- [x] Login form features:
  - [x] Email and password fields
  - [x] Password visibility toggle
  - [x] Loading state on submit
  - [x] Error messages
  - [x] Demo mode fallback (demo@example.com / demo123)
- [x] Responsive design (stacks vertically on mobile)
- [x] Hover effects on cards

**Files Created/Modified:**

| File | Changes |
|------|---------|
| `templates/pages/client-landing.ejs` | Created new template with two-card layout |
| `src/styles/pages/client.css` | Added `.portal-cards` and `.portal-card` styles |

**Route:** `/client/landing`

---

### Client Portal File Management System

**Completed:** December 1, 2025

**Summary:** Implemented complete file management functionality for the Client Portal including backend API endpoints and frontend drag & drop upload, file listing, preview, and download.

**Features Implemented:**

- [x] Backend GET endpoint for listing client files (`/api/uploads/client`)
- [x] Backend GET endpoint for project files (`/api/uploads/project/:projectId`)
- [x] Backend GET endpoint for file download/preview (`/api/uploads/file/:fileId`)
- [x] Backend DELETE endpoint for file deletion (`/api/uploads/file/:fileId`)
- [x] Frontend drag & drop file upload with visual feedback
- [x] Frontend file list rendering from API with demo fallback
- [x] Frontend file preview (opens images/PDFs in new tab)
- [x] Frontend file download functionality
- [x] File type icons (document, image, PDF)
- [x] File size formatting
- [x] Upload progress indication
- [x] Success message after upload
- [x] XSS protection via HTML escaping

**Backend Endpoints Added (`server/routes/uploads.ts`):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/uploads/client` | GET | Get all files for authenticated client |
| `/api/uploads/project/:projectId` | GET | Get all files for a specific project |
| `/api/uploads/file/:fileId` | GET | Download/preview file with access control |
| `/api/uploads/file/:fileId` | DELETE | Delete file (ownership verification) |

**Frontend Methods Added (`src/features/client/client-portal.ts`):**

| Method | Purpose |
|--------|---------|
| `loadFiles()` | Fetch files from API, render list |
| `renderDemoFiles()` | Demo mode fallback with sample files |
| `renderFilesList()` | Render file items with icons and actions |
| `getFileIcon()` | Get SVG icon based on file type |
| `formatFileSize()` | Convert bytes to human-readable format |
| `escapeHtml()` | Prevent XSS in file names |
| `attachFileActionListeners()` | Bind preview/download button events |
| `previewFile()` | Open file in new tab (images/PDFs) |
| `downloadFile()` | Trigger file download |
| `setupFileUploadHandlers()` | Setup drag & drop and browse button |
| `uploadFiles()` | Upload files via FormData |
| `resetDropzone()` | Restore dropzone after upload |
| `showUploadSuccess()` | Show success message |

**Files Modified:**

| File | Changes |
|------|---------|
| `server/routes/uploads.ts` | Added 4 new endpoints for file CRUD |
| `src/features/client/client-portal.ts` | Added ~400 lines of file handling code |
| `eslint.config.js` | Added `File`, `FileList`, `DataTransfer` to globals |

**Verification:**

- [x] TypeScript: 0 errors
- [x] ESLint: 0 errors
- [x] Tests: 259 passing
- [x] Build: Success

---

### Client Portal Invoice Management System

**Completed:** December 1, 2025

**Summary:** Implemented complete invoice management functionality for the Client Portal including backend API endpoint and frontend invoice list, summary stats, preview, and download.

**Features Implemented:**

- [x] Backend GET endpoint for authenticated client invoices (`/api/invoices/me`)
- [x] Summary statistics (total outstanding, total paid)
- [x] Frontend invoice list rendering from API with demo fallback
- [x] Invoice status badges (Pending, Paid, Overdue, etc.)
- [x] Invoice preview (opens in new tab)
- [x] Invoice download functionality
- [x] Currency formatting with Intl.NumberFormat
- [x] Tab switching triggers invoice load

**Backend Endpoint Added (`server/routes/invoices.ts`):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/invoices/me` | GET | Get all invoices for authenticated client with summary stats |

**Frontend Methods Added (`src/features/client/client-portal.ts`):**

| Method | Purpose |
|--------|---------|
| `loadInvoices()` | Fetch invoices from API, update summary, render list |
| `renderDemoInvoices()` | Demo mode fallback with sample invoices |
| `renderInvoicesList()` | Render invoice items with status and actions |
| `getInvoiceStatusClass()` | Get CSS class for status badge |
| `getInvoiceStatusLabel()` | Get display label for status |
| `formatCurrency()` | Format numbers as USD currency |
| `attachInvoiceActionListeners()` | Bind preview/download button events |
| `previewInvoice()` | Open invoice in new tab |
| `downloadInvoice()` | Trigger invoice download |

**Verification:**

- [x] TypeScript: 0 errors
- [x] ESLint: 0 errors
- [x] Build: Success

---

### Emoji Picker Web Component Integration

**Completed:** December 1, 2025

**Summary:** Replaced custom emoji picker with `emoji-picker-element` web component

**Implementation:**

- [x] Installed `emoji-picker-element` npm package
- [x] Added import in client-portal.ts
- [x] Updated template to use `<emoji-picker>` web component
- [x] Updated event handlers for `emoji-click` custom event
- [x] Added CSS custom properties for theme matching
- [x] Added Enter key to send message (Shift+Enter for newline)

**Files Modified:**

| File | Changes |
|------|---------|
| `src/features/client/client-portal.ts:15` | Added emoji-picker-element import |
| `src/features/client/client-portal.ts:195-228` | Web component event listeners |
| `src/styles/pages/client-portal.css:1064-1083` | Emoji picker styling |
| `templates/pages/client-portal.ejs:175-177` | Uses `<emoji-picker>` element |
| `package.json` | Added dependency |

---

### Client Portal Authentication

**Completed:** December 1, 2025

**Summary:** Replaced mock login with real JWT authentication against backend API

**Features:**

- [x] Real authentication via `/api/auth/login` endpoint
- [x] JWT token storage in localStorage
- [x] Demo mode fallback when backend unavailable
- [x] Error handling for invalid credentials
- [x] Account inactive error handling

---

### Admin Dashboard Improvements

**Completed:** December 1, 2025

**Summary:** Enhanced admin dashboard with JWT authentication and analytics

**Features:**

- [x] JWT authentication for admin routes
- [x] Chart.js analytics integration
- [x] Data service methods for ventures

---

### Test Suite Fixes

**Completed:** December 1, 2025

**Summary:** Fixed all 77 failing tests, now 259 tests pass

---

### Client Portal Feature Completion

**Completed:** December 1, 2025

**Summary:** Fully built out all remaining Client Portal features including file delete, settings save, new project submission, project preview, invoice PDF generation, and messaging.

**Features Implemented:**

- [x] **File Delete** - Added delete button with confirmation to file list
- [x] **Settings Save** - Profile, password, notifications, and billing info now save to backend
- [x] **New Project** - Form submission creates project request with admin notification
- [x] **Project Preview** - Iframe loads project preview URL from API
- [x] **Invoice PDF** - Full PDF generation with pdfkit for invoice downloads
- [x] **Messages** - Connected to messaging API with thread support and send functionality

**Backend Endpoints Added:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clients/me` | GET | Get current client's profile |
| `/api/clients/me` | PUT | Update profile info |
| `/api/clients/me/password` | PUT | Change password |
| `/api/clients/me/notifications` | PUT | Update notification preferences |
| `/api/clients/me/billing` | PUT | Update billing information |
| `/api/projects/request` | POST | Submit new project request |
| `/api/invoices/:id/pdf` | GET | Download invoice as PDF |

**Database Migrations Added:**

| Migration | Description |
|-----------|-------------|
| `006_client_settings_columns.sql` | Notification and billing columns on clients |
| `007_project_request_columns.sql` | Project type, budget, timeline, preview URL |

**Frontend Methods Added:**

| Method | Purpose |
|--------|---------|
| `deleteFile()` | Delete file with confirmation |
| `setupSettingsFormHandlers()` | Bind settings form events |
| `saveProfileSettings()` | Save profile + password changes |
| `saveNotificationSettings()` | Save notification preferences |
| `saveBillingSettings()` | Save billing info |
| `submitProjectRequest()` | Submit new project form |
| `loadProjectPreview()` | Load preview into iframe |
| `loadMessagesFromAPI()` | Fetch messages from API |
| `renderMessages()` | Render message list |
| `sendMessage()` | Send message to thread |

**Dependencies Added:**

| Package | Version | Purpose |
|---------|---------|---------|
| `pdfkit` | ^0.x | PDF generation for invoices |

---

### Module Loading Optimization

**Completed:** December 1, 2025

**Summary:** Conditionally load modules based on page type to prevent unnecessary code execution.

- Client Portal only loads `ThemeModule` and `ClientPortalModule`
- Admin Dashboard only loads `ThemeModule` and `AdminDashboardModule`
- Main site loads full module set

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/features/client/client-portal.ts` | Main client portal module (~2400 lines) |
| `server/routes/uploads.ts` | File upload API endpoints |
| `server/routes/clients.ts` | Client profile/settings API |
| `server/routes/projects.ts` | Project/request API |
| `server/routes/invoices.ts` | Invoice API + PDF generation |
| `server/routes/messages.ts` | Messaging API |
| `src/styles/pages/client-portal.css` | Client portal styles |
| `templates/pages/client-portal.ejs` | Client portal HTML template |

### Development Commands

```bash
# Start full development environment
npm run dev:full

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test:run

# Build for production
npm run build
```

### Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `emoji-picker-element` | ^1.x | Web component emoji picker |
| `pdfkit` | ^0.x | PDF generation for invoices |

---

## Archived Work

Previous work has been completed and verified. See git history for details.
