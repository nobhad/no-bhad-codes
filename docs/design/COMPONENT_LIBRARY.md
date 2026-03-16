# Portal Component Library

**Last Updated:** March 16, 2026

Complete catalog of React components used in the admin dashboard and client portal. All portal UI components are located under `src/react/`.

---

## Table of Contents

1. [Portal Components](#portal-components)
2. [UI Base Components](#ui-base-components)
3. [Factory Components](#factory-components)
4. [Portal Feature Components](#portal-feature-components)
5. [Hooks](#hooks)
6. [CSS Classes Reference](#css-classes-reference)
7. [Accessibility](#accessibility)
8. [Icon Usage](#icon-usage)

---

## Portal Components

Located in `src/react/components/portal/`. Shared across admin and client portals.

### Layout and Structure

| Component | File | Purpose |
|-----------|------|---------|
| `PortalViewLayout` | `PortalViewLayout.tsx` | Shared wrapper for all portal views. Provides container, fade-in animation, loading/error handling. |
| `TableLayout` | `TableLayout.tsx` | Unified table wrapper: header (title/stats/actions), container, pagination, bulk actions. Use `nested` prop inside hubs. |
| `RouteErrorBoundary` | `RouteErrorBoundary.tsx` | Route-aware error boundary for PortalLayout Outlet. Auto-resets on navigation. |
| `ErrorBoundary` | `ErrorBoundary.tsx` | General-purpose error boundary with fallback UI. |

### Buttons and Actions

| Component | File | Purpose |
|-----------|------|---------|
| `PortalButton` | `PortalButton.tsx` | Portal design system button with variants (primary, secondary, danger, ghost, icon) and loading state. |
| `TableActionButton` / `TableActions` | `TableActionButton.tsx` | Re-exports icon button components from factories for backwards compatibility. |
| `BulkActionsToolbar` | `BulkActionsToolbar.tsx` | Toolbar above table when items are selected. Shows selection count and bulk action buttons/dropdowns. |
| `CopyEmailButton` | `CopyEmailButton.tsx` | Inline copy-to-clipboard button for email addresses with optional notification callback. |

### Forms and Inputs

| Component | File | Purpose |
|-----------|------|---------|
| `PortalInput` | `PortalInput.tsx` | Styled text input with label, error message, and helper text support. |
| `InlineEditField` | `InlineEditField.tsx` | Click-to-edit inline field with save/cancel via Enter/blur/buttons. |
| `InlineEdit` / `InlineSelect` / `InlineTextarea` | `InlineEdit.tsx` | Collection of inline-edit cell components (text, select, date) with DRY state management. |
| `FileUpload` | `FileUpload.tsx` | Drag-and-drop file upload with multiple file support, max size validation, MIME type filtering. |
| `FormDropdown` | `FormDropdown.tsx` | Simple custom dropdown for form selects. No Radix -- uses custom-dropdown CSS. |
| `ModalDropdown` | `ModalDropdown.tsx` | Modal-style dropdown with search, multi-select, descriptions, and GSAP scale-in animation. |

### Data Display

| Component | File | Purpose |
|-----------|------|---------|
| `DataTable` | `DataTable/DataTable.tsx` | Advanced data table with search, filtering, sorting, pagination, bulk actions, row selection. |
| `PortalTable` | `PortalTable.tsx` | Generic table component (header/body/row/cell sub-components). Optional GSAP row animations. |
| `TableFilters` / `SearchFilter` / `FilterDropdown` | `TableFilters.tsx` | Icon-button search with collapsible dropdown and filter controls. |
| `TablePagination` | `TablePagination.tsx` | Unified pagination: page info, page size selector, navigation buttons. |
| `StatCard` / `StatsRow` | `StatCard.tsx` | Reusable stat card replacing repeated raw HTML patterns. |
| `ProgressBar` | `ProgressBar.tsx` | Reusable progress bar with label, percentage, and optional detail info. |
| `StatusBadge` | `StatusBadge.tsx` | Visual status indicator badges with color mapping. Variants: active, pending, completed, cancelled, qualified, inactive, new, on-hold. |
| `StatusDropdownCell` | `StatusDropdownCell.tsx` | Status dropdown specifically for table cells. Shows badge with dropdown trigger. |
| `EmptyState` / `ErrorState` / `LoadingState` / `Skeleton` | `EmptyState.tsx` | Re-exports factory state components with portal-specific presets. |

### Dropdowns and Menus

| Component | File | Purpose |
|-----------|------|---------|
| `PortalDropdown` | `PortalDropdown.tsx` | Styled dropdown using Radix primitives. Sub-components: Trigger, Content, Item, Sub, Group, RadioGroup. |
| `CommandPalette` | `CommandPalette.tsx` | Cmd+K command palette for quick navigation. Reads from unified-navigation config, filters by role. |

### Modals and Dialogs

| Component | File | Purpose |
|-----------|------|---------|
| `PortalModal` | `PortalModal.tsx` | Modal using Radix primitives. Size variants: sm, md, lg, xl, full. GSAP scale-in animation. |
| `ConfirmDialog` / `useConfirmDialog` | `ConfirmDialog.tsx` | Confirmation dialog with variants (danger, warning, info). Uses AlertDialog primitives. |

### Other

| Component | File | Purpose |
|-----------|------|---------|
| `NotificationBell` | `NotificationBell.tsx` | Header notification bell with dropdown. Fetches based on user role. |
| `KeyboardShortcutsOverlay` | `KeyboardShortcutsOverlay.tsx` | Modal overlay displaying keyboard shortcuts. Triggered by pressing "?". |
| `SignatureCanvas` | `../SignatureCanvas.tsx` | Two-mode signature input (draw or type cursive). Exports as base64 PNG. |

---

## UI Base Components

Located in `src/react/components/ui/`. Low-level Radix-based primitives.

| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `button.tsx` | Base button with CVA variants mapping to portal CSS classes |
| `Input` | `input.tsx` | Base HTML input wrapper with `form-input` CSS class |
| `Checkbox` | `checkbox.tsx` | Radix checkbox with `portal-checkbox` styling |
| `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` | `select.tsx` | Radix select -- **avoid using directly**, prefer `PortalDropdown` |
| `Dialog` / `DialogContent` / `DialogHeader` | `dialog.tsx` | Radix dialog with portal modal overlay styling |
| `AlertDialog` / `AlertDialogContent` | `alert-dialog.tsx` | Radix alert dialog for confirmations |
| `Badge` | `badge.tsx` | Status badge with CVA variants |
| `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` | `table.tsx` | Semantic HTML table components |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `tabs.tsx` | Radix tabs for tab navigation |
| `DropdownMenu` | `dropdown-menu.tsx` | Radix dropdown primitives |

---

## Factory Components

Located in `src/react/factories/`. Reusable building blocks shared across features.

| Component | File | Purpose |
|-----------|------|---------|
| `MessageThread` | `MessageThread.tsx` | Chat thread rendering (send, edit, react, receipts) |
| `IconButton` / `TableActions` | `IconButton.tsx` | Icon button primitives and table action wrapper |
| `DataTable` | `DataTable/` | Generic sortable/filterable data table |
| `InlineEdit` | `InlineEdit.tsx` | Click-to-edit inline field |
| `SearchFilter` / `TableFilters` | `TableFilters.tsx` | Table filter bar components |

---

## Portal Feature Components

Organized by feature in `src/react/features/`.

### Client Portal (`src/react/features/portal/`)

| Component | Path | Purpose |
|-----------|------|---------|
| `ActionItems` | `dashboard/ActionItems.tsx` | "Needs Your Attention" section with pending action StatCards |
| `PortalProjectsList` | `projects/PortalProjectsList.tsx` | Projects list with cards, search, and filter |
| `PortalContracts` | `contracts/PortalContracts.tsx` | Contracts list with ContractSignModal |
| `ContractCard` | `contracts/ContractCard.tsx` | Individual contract card |
| `ContractSignModal` | `contracts/ContractSignModal.tsx` | Signature modal with SignatureCanvas |
| `PortalApprovals` | `approvals/PortalApprovals.tsx` | Approvals list with filter/search |
| `PortalAdHocRequests` | `ad-hoc-requests/PortalAdHocRequests.tsx` | Ad-hoc request list + new request form |
| `PortalDocumentRequests` | `document-requests/PortalDocumentRequests.tsx` | Document request list |
| `PortalQuestionnairesView` | `questionnaires/PortalQuestionnairesView.tsx` | Questionnaires list |
| `QuestionnaireForm` | `questionnaires/QuestionnaireForm.tsx` | Questionnaire fill-out form |
| `PortalProposals` | `proposals/PortalProposals.tsx` | Proposals list |
| `DeliverableCard` | `deliverables/DeliverableCard.tsx` | Individual deliverable card |
| `ProfileForm` | `settings/ProfileForm.tsx` | Contact info form with InlineEditField |
| `NotificationsForm` | `settings/NotificationsForm.tsx` | Notification preferences |
| `OnboardingWizard` | `onboarding/OnboardingWizard.tsx` | Multi-step onboarding with GSAP animations |
| `PortalPreview` | `preview/PortalPreview.tsx` | Document/content preview |
| `ContentChecklistView` | `content-requests/ContentChecklistView.tsx` | Content request checklist |

### Admin Portal (`src/react/features/admin/`)

| Component | Path | Purpose |
|-----------|------|---------|
| `AdminModalsProvider` | `modals/AdminModalsProvider.tsx` | Bridges vanilla JS admin dashboard with React modals via custom events |
| `DetailModal` | `modals/DetailModal.tsx` | Generic detail display modal |
| `AddClientModal` | `modals/AddClientModal.tsx` | New client form modal |
| `AddProjectModal` | `modals/AddProjectModal.tsx` | New project form modal |
| `EditClientInfoModal` | `modals/EditClientInfoModal.tsx` | Edit client info modal |
| `EditBillingModal` | `modals/EditBillingModal.tsx` | Edit billing info modal |
| `CreateEntityModals` | `modals/CreateEntityModals.tsx` | Entity creation modals |
| `OverviewTab` | `project-detail/tabs/OverviewTab.tsx` | Project detail overview |
| `IntakeTab` | `project-detail/tabs/IntakeTab.tsx` | Project intake tab |
| `ProjectDetailsCard` | `project-detail/tabs/overview/ProjectDetailsCard.tsx` | Project details card |
| `SidebarInfo` | `project-detail/tabs/overview/SidebarInfo.tsx` | Project sidebar info |
| `ProjectLinksCard` | `project-detail/tabs/overview/ProjectLinksCard.tsx` | Project links card |
| `MilestonesList` | `project-detail/tabs/overview/MilestonesList.tsx` | Project milestones list |
| `BusinessConfiguration` | `settings/BusinessConfiguration.tsx` | Business config settings |
| `WebhookTestModal` | `webhooks/WebhookTestModal.tsx` | Webhook test modal |
| `WebhookFormModal` | `webhooks/WebhookFormModal.tsx` | Webhook create/edit modal |
| `NotificationFormModal` | `integrations/NotificationFormModal.tsx` | Notification integration modal |
| `IntegrationsManager` | `integrations/IntegrationsManager.tsx` | Integrations management |
| `SystemStatusDashboard` | `system-status/SystemStatusDashboard.tsx` | System status dashboard |
| `WorkDashboard` | `work/WorkDashboard.tsx` | Work management dashboard |
| `LeadScoringRuleForm` | `leads/LeadScoringRuleForm.tsx` | Lead scoring rule config |

### Auth (`src/react/features/auth/`)

| Component | Path | Purpose |
|-----------|------|---------|
| `AuthGate` | `AuthGate.tsx` | Auth wrapper for admin/client portals |

---

## Hooks

Located in `src/react/hooks/`.

### Core Portal Hooks

| Hook | File | Purpose |
|------|------|---------|
| `usePortalAuth` | `usePortalAuth.ts` | Wraps vanilla authStore for React. Uses `useSyncExternalStore`. |
| `usePortalData` / `usePortalFetch` | `usePortalFetch.ts` | Shared data-fetching with auth headers and error handling. |
| `useSelection` | `useSelection.ts` | Multi-item selection for tables with bulk actions. |
| `usePagination` | `usePagination.ts` | Pagination state with localStorage persistence. |
| `useTableFilters` | `useTableFilters.ts` | Table filtering, searching, sorting with localStorage persistence. |
| `useFormState` | `useFormState.ts` | Form state management with validation. |
| `useExport` | `useExport.ts` | Data export (CSV/PDF). |
| `useEntityOptions` | `useEntityOptions.ts` | Fetch entity options for dropdowns. |
| `useEventSource` | `useEventSource.ts` | SSE connection management. |
| `useLogger` | `useLogger.ts` | Logging utility. |

### Animation Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useFadeIn` | `useGsap.ts` | GSAP fade-in with opacity and Y offset |
| `useSlideIn` | `useGsap.ts` | GSAP slide-in from direction with fade |
| `useStaggerChildren` | `useGsap.ts` | GSAP stagger child element animations |
| `useScaleIn` | `useGsap.ts` | GSAP scale-in with opacity (modals, buttons) |
| `useGsapTimeline` | `useGsap.ts` | Programmatically controlled GSAP timeline |
| `useScrollReveal` | `useGsap.ts` | Scroll-triggered reveal (requires ScrollTrigger) |

### Data Fetching Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useProjects` | `useProjects.ts` | Projects list data |
| `useProjectDetail` | `useProjectDetail.ts` | Single project detail |
| `useClients` | `useClients.ts` | Clients list data |
| `useClientDetail` | `useClientDetail.ts` | Single client detail |
| `useInvoices` | `useInvoices.ts` | Invoices management |
| `usePortalInvoices` | `usePortalInvoices.ts` | Portal-specific invoices |
| `useLeads` | `useLeads.ts` | Leads management |

### Project Detail Hooks (`hooks/project-detail/`)

| Hook | Purpose |
|------|---------|
| `useProjectCore` | Core project data |
| `useProjectMilestones` | Project milestones |
| `useProjectTasks` | Project tasks |
| `useProjectInvoices` | Project invoices |
| `useProjectFiles` | Project files |
| `useProjectMessages` | Project messages |

### Client Detail Hooks (`hooks/client-detail/`)

| Hook | Purpose |
|------|---------|
| `useClientCore` | Core client data |
| `useClientContacts` | Client contacts |
| `useClientNotes` | Client notes |
| `useClientTags` | Client tags |

---

## CSS Classes Reference

Quick reference for the most-used portal CSS classes. For full details see [Portal Design](./PORTAL_DESIGN.md).

### Buttons

```css
.btn, .btn-primary, .btn-secondary, .btn-danger, .btn-ghost, .icon-btn, .btn-sm
```

### Status Badges

```css
.status-badge, .status-badge-active, .status-badge-pending, .status-badge-completed, .status-badge-cancelled
```

### Tables

```css
.data-table, .col-actions, .action-group, .data-table-row-actions
```

### Forms

```css
.form-group, .field-label, .form-input, .form-textarea, .form-select
```

### Layout

```css
.section, .subsection, .panel, .table-layout, .data-table-card, .portal-card
```

---

## Accessibility

- All interactive components use ARIA roles and attributes
- `icon-btn` buttons require `title` or `aria-label`
- Modals use `role="dialog"` and focus trap
- Dropdowns use `aria-haspopup="menu"` and `aria-expanded`

---

## Icon Usage

Use Lucide React icons exclusively. No emojis in UI.

```tsx
import { Pencil, Trash2, Check, X } from 'lucide-react';

<button className="icon-btn" title="Edit">
  <Pencil />
</button>
```

SVG icons default to `1em` -- set `font-size` on the parent to control icon size. Within table action containers, `--portal-btn-icon-size` is scoped to `--icon-size-sm` (16px).

---

## InlineEdit Date Field Pattern

Date fields (`type="date"`) follow a strict visual pattern:

**Display state:** `[Calendar icon]  Set start date`

**Edit state:** `[Calendar icon | mm/dd/yyyy]  check  x`

Rules:

- Calendar icon always on the left
- Browser native calendar picker hidden (`-webkit-calendar-picker-indicator: none`)
- Use `<InlineEdit type="date">` -- never raw `<input type="date">`
- Do not wrap with outer Calendar icon -- managed internally

CSS classes: `.inline-edit-date-wrapper`, `.inline-edit-date-cal`, `.inline-edit-input-compact--date`

```tsx
<InlineEdit
  value={project.start_date || ''}
  type="date"
  placeholder="Set start date"
  onSave={(value) => onSaveField('start_date', value)}
/>
```

---

## Related Documentation

- [Portal Design](./PORTAL_DESIGN.md) -- Portal theme, components, layout system
- [CSS Architecture](./CSS_ARCHITECTURE.md) -- Shared tokens, file organization
- [Animations](./ANIMATIONS.md) -- Animation standards and GSAP usage
