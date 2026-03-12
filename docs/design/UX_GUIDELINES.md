# UX Guidelines

**Last Updated:** March 11, 2026

User experience rules and patterns for the portal. These are mandatory and must be followed in all implementations.

---

## File Upload Areas

### No Dropzones on Mobile

**RULE:** On mobile/touch devices, file upload areas must **never** show a drag-and-drop dropzone. Drag-and-drop is not possible on touch devices.

**What to show instead:**

- An upload button (e.g., "Browse Files")
- File type/size hints (e.g., "Max 10MB, PDF/JPG/PNG")

**What to hide on mobile:**

- Dashed border dropzone container
- "Drag and drop files here" text
- Upload cloud/arrow icon above the button

**Implementation:** CSS handles this automatically via `@media (--mobile)` rules in `portal-files.css`. Both `.dropzone` and `.upload-dropzone` classes strip their visual chrome on mobile, leaving only the browse button and hints visible.

**Applies to ALL file upload areas:**

- Client portal file uploads
- Document request uploads
- Profile/avatar uploads
- Ad-hoc request attachments
- Questionnaire file attachments
- Admin file management

---

## Icons

### No Emojis

**RULE:** Never use emojis in the UI. Use Lucide icons for all iconography.

---

## Action Buttons

### Universal Icon Button Rules

All icon-only action buttons must use the `.icon-btn` CSS class from `portal-buttons.css`. This ensures:

- Consistent 36px hit area (`--portal-btn-icon-size`)
- Transparent background, no border
- Accent color on hover
- Proper focus ring for accessibility
- Icon sizing controlled by CSS variables (not hardcoded)

**Use `<IconButton>` factory component** (from `src/react/factories/IconButton.tsx`) instead of inline `<button className="icon-btn">` with manual icon imports. The factory handles icon resolution, accessibility labels, and variant styling automatically.

**Button clusters** must use `gap: var(--action-btn-gap)` (8px) between adjacent buttons.

---

## Password Fields

### View Toggle Required

**RULE:** All password input fields must include a visibility toggle button (show/hide password).
