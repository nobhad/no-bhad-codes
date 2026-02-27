# UI Factory System

**Last Updated:** 2026-02-26

## Overview

The UI Factory System provides a unified, centralized approach to creating UI components across both vanilla TypeScript and React. It ensures consistency in sizing, styling, and behavior while reducing code duplication.

## Directory Structure

```text
src/factories/
├── index.ts                    # Central export hub
├── types.ts                    # Shared TypeScript interfaces
├── constants.ts                # UI constants (sizes, contexts)
│
├── icons/
│   ├── icon-factory.ts         # Core icon rendering
│   └── icon-registry.ts        # Icon definitions (60+ icons)
│
├── buttons/
│   ├── button-factory.ts       # Core button rendering
│   ├── button-actions.ts       # Action definitions (40+)
│   └── button-sets.ts          # Predefined button combinations
│
└── components/
    ├── badge-factory.ts        # Status badges
    └── state-factory.ts        # Empty/loading/error states

src/react/factories/
├── index.ts                    # React factory exports
├── IconButton.tsx              # React icon button component
├── useFactory.ts               # React hooks
├── StatusBadge.tsx             # React badge components
└── StateDisplay.tsx            # React state components
```

## Core Concepts

### UI Contexts

Different UI contexts have different optimal sizes:

| Context  | Icon Size | Button Size | Gap  | Usage                    |
|----------|-----------|-------------|------|--------------------------|
| table    | 18px (lg) | 36px (lg)   | 8px  | Table row actions        |
| modal    | 24px (2xl)| 40px (xl)   | 12px | Modal buttons            |
| toolbar  | 18px (lg) | 36px (lg)   | 8px  | Toolbar actions          |
| card     | 16px (md) | 32px (md)   | 4px  | Card actions             |
| sidebar  | 18px (lg) | 36px (lg)   | 8px  | Sidebar navigation       |
| inline   | 14px (sm) | 28px (sm)   | 4px  | Inline/compact actions   |

### Icon Sizes

```typescript
const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,      // Table standard (desktop)
  xl: 20,
  '2xl': 24,   // Modal standard
  '3xl': 32
};
```

## Usage

### Vanilla TypeScript

#### Rendering Icon Buttons

```typescript
import { renderButton, renderActionsCell } from '@factories';

// Single button
const buttonHtml = renderButton({
  action: 'view',
  dataId: row.id
});

// Multiple buttons in actions cell
const actionsHtml = renderActionsCell([
  { action: 'view', dataId: row.id },
  { action: 'edit', dataId: row.id },
  { action: 'delete', dataId: row.id }
]);
```

#### Using Button Sets

```typescript
import { getButtonSet, renderActionsCell } from '@factories';

// Get predefined button set
const buttons = getButtonSet('tableCrud', row.id);
const html = renderActionsCell(buttons);

// Available sets:
// - tableCrud: view, edit, delete
// - tableViewDelete: view, delete
// - tableFile: preview, download, delete
// - tableDeletedItem: restore, delete permanently
// - tableLead: view, convert, email, delete
// - tableProposal: view, send, convert, delete
// - tableInvoice: view, send, mark-paid, delete
// - modalConfirm: cancel, save
// - modalDestructive: cancel, delete
```

#### Rendering Icons

```typescript
import { renderIcon, getIconSvg } from '@factories';

// With full config
const icon = renderIcon({
  name: 'eye',
  size: 'lg',
  className: 'my-icon'
});

// Simple helper
const icon = getIconSvg('edit', 18);
```

#### Rendering Badges

```typescript
import { renderBadge, renderDot } from '@factories';

// Status badge
const badge = renderBadge({ status: 'active' });
const badge = renderBadge({ status: 'pending', label: 'Awaiting Review' });

// Status dot indicator
const dot = renderDot({ status: 'completed' });
```

#### Rendering States

```typescript
import { renderEmptyState, renderLoadingState, renderErrorState } from '@factories';

// Empty state
container.innerHTML = renderEmptyState({
  message: 'No items found',
  ctaLabel: 'Add Item'
});

// Loading state
container.innerHTML = renderLoadingState({
  message: 'Loading...',
  skeleton: true,
  skeletonType: 'table',
  skeletonCount: 5
});

// Error state
container.innerHTML = renderErrorState({
  message: 'Failed to load data',
  type: 'network',
  onRetry: () => refetch()
});
```

### React

#### IconButton Component

```tsx
import { IconButton, ActionButton } from '@react/factories';

// Using action (recommended)
<IconButton action="view" onClick={() => handleView(id)} />
<IconButton action="edit" dataId={row.id} />
<IconButton action="delete" variant="danger" />

// With options
<IconButton
  action="refresh"
  loading={isLoading}
  disabled={isDisabled}
/>

// Using icon name directly
<IconButton icon="settings" onClick={openSettings} />

// ActionButton shorthand
<ActionButton action="save" variant="primary" />
```

#### useButtonFactory Hook

```tsx
import { useButtonFactory } from '@react/factories';

function MyTable({ data }) {
  const { renderButtonGroup } = useButtonFactory({
    context: 'table',
    onClick: (action, id) => handleAction(action, id)
  });

  return (
    <table>
      {data.map(row => (
        <tr key={row.id}>
          <td>{row.name}</td>
          <td>
            {renderButtonGroup([
              { action: 'view', dataId: row.id },
              { action: 'edit', dataId: row.id },
              { action: 'delete', dataId: row.id }
            ])}
          </td>
        </tr>
      ))}
    </table>
  );
}
```

#### useTableActions Hook

```tsx
import { useTableActions } from '@react/factories';

function MyTable({ data }) {
  const { renderActions } = useTableActions({
    onAction: (action, id) => {
      switch (action) {
        case 'view': handleView(id); break;
        case 'edit': handleEdit(id); break;
        case 'delete': handleDelete(id); break;
      }
    },
    actions: [
      { action: 'view' },
      { action: 'edit' },
      { action: 'delete', show: (row) => row.canDelete }
    ]
  });

  return (
    <table>
      {data.map(row => (
        <tr key={row.id}>
          <td>{row.name}</td>
          <td>{renderActions(row.id, row)}</td>
        </tr>
      ))}
    </table>
  );
}
```

#### StatusBadge Component

```tsx
import { StatusBadge, StatusDot } from '@react/factories';

// Badge
<StatusBadge status="active" />
<StatusBadge status="pending" label="Awaiting Approval" />
<StatusBadge status={user.status} size="sm" />

// Dot indicator
<StatusDot status="completed" />
<StatusDot status="in-progress" uppercase />
```

#### State Display Components

```tsx
import { EmptyState, LoadingState, ErrorState, Skeleton } from '@react/factories';

// Empty state
<EmptyState
  message="No clients found"
  icon={<Inbox />}
  ctaLabel="Add Client"
  onCtaClick={() => openModal()}
/>

// Loading state
<LoadingState message="Loading clients..." />
<LoadingState skeleton skeletonType="table" skeletonCount={5} />

// Error state
<ErrorState
  message="Failed to load data"
  type="network"
  onRetry={refetch}
/>

// Skeleton only
<Skeleton type="cards" count={4} />
```

## Available Actions

All actions are defined in `button-actions.ts`:

### Navigation

| Action   | Icon       | Title    |
|----------|------------|----------|
| view     | eye        | View     |
| preview  | eye        | Preview  |
| back     | arrow-left | Back     |
| close    | x          | Close    |

### Edit/Modify

| Action | Icon  | Title  |
|--------|-------|--------|
| edit   | edit  | Edit   |
| save   | check | Save   |
| cancel | x     | Cancel |

### CRUD

| Action | Icon  | Title  | Variant |
|--------|-------|--------|---------|
| add    | plus  | Add    | -       |
| create | plus  | Create | primary |
| delete | trash | Delete | danger  |
| remove | x     | Remove | -       |

### Communication

| Action  | Icon           | Title         |
|---------|----------------|---------------|
| send    | send           | Send          |
| remind  | bell           | Send Reminder |
| email   | mail           | Email         |
| message | message-square | Message       |

### Approval

| Action       | Icon         | Title        | Variant |
|--------------|--------------|--------------|---------|
| approve      | circle-check | Approve      | success |
| reject       | circle-x     | Reject       | danger  |
| start-review | check-square | Start Review | -       |
| mark-paid    | circle-check | Mark as Paid | success |

### Download/Export

| Action   | Icon     | Title    |
|----------|----------|----------|
| download | download | Download |
| export   | download | Export   |
| copy     | copy     | Copy     |

### Convert/Transform

| Action          | Icon      | Title               |
|-----------------|-----------|---------------------|
| convert         | rocket    | Convert             |
| convert-client  | user-plus | Convert to Client   |
| convert-project | rocket    | Convert to Project  |
| activate        | rocket    | Activate            |

### Status/Toggle

| Action    | Icon    | Title     |
|-----------|---------|-----------|
| toggle    | eye     | Toggle    |
| enable    | eye     | Enable    |
| disable   | eye-off | Disable   |
| publish   | globe   | Publish   |
| unpublish | eye-off | Unpublish |

### Archive/Restore

| Action    | Icon       | Title     | Variant |
|-----------|------------|-----------|---------|
| archive   | archive    | Archive   | -       |
| restore   | rotate-ccw | Restore   | -       |
| expire    | clock      | Expire    | warning |
| unarchive | rotate-ccw | Unarchive | -       |

### Utility

| Action  | Icon          | Title   |
|---------|---------------|---------|
| refresh | refresh       | Refresh |
| search  | search        | Search  |
| filter  | filter        | Filter  |
| more    | more-vertical | More    |

## Available Icons

The icon registry contains 60+ icons organized by category:

### Navigation

eye, eye-off, arrow-left, chevron-left, chevron-right, chevron-down, chevron-up, external-link

### Actions

edit, trash, plus, x, copy, download, upload, refresh, rotate-ccw, archive, send, search, filter

### Status

check, circle-check, circle-x, check-square, clock, bell, help-circle

### Files

file, file-text, file-signature, folder, image, paperclip, clipboard

### Communication

mail, message-square, inbox

### Interface

more-vertical, more-horizontal, layout-dashboard, settings, list, list-todo, globe, loader, play, pause, pin, lock, unlock

### Data/Business

users, user, user-plus, briefcase, receipt, bar-chart, rocket, workflow, package, book-open, zap, calendar, dollar-sign, tag, star, percent

### Additional Utility Icons

link, link-2, hash, alert, info, star-off

## Migration Guide

### From Direct Lucide Imports

**Before:**

```tsx
import { Eye, Edit, Trash2 } from 'lucide-react';

<button className="icon-btn" onClick={() => handleView(id)} title="View">
  <Eye size={18} />
</button>
<button className="icon-btn" onClick={() => handleEdit(id)} title="Edit">
  <Edit size={18} />
</button>
```

**After:**

```tsx
import { IconButton } from '@react/factories';

<IconButton action="view" onClick={() => handleView(id)} />
<IconButton action="edit" onClick={() => handleEdit(id)} />
```

### From Legacy Components

The legacy components (`table-action-buttons.ts`, `status-badge.ts`, `empty-state.ts`) now use the factory system internally. They maintain backwards compatibility but new code should import directly from `@factories` or `@react/factories`.

## Path Aliases

```typescript
// Vanilla TypeScript
import { renderButton, BUTTON_ACTIONS } from '@factories';

// React
import { IconButton, useButtonFactory } from '@react/factories';
```

## Specialized Button Sets

Beyond the basic sets, the factory provides specialized sets for common module patterns:

| Set Name | Actions | Use Case |
|----------|---------|----------|
| `tableQuestionnaire` | edit, send, delete | Questionnaire tables |
| `tableQuestionnaireResponse` | view, remind, delete | Response tables |
| `tableContact` | convert-client, archive/restore | Contact forms |
| `tableContract` | view, remind, expire | Contract management |
| `tableEmailTemplate` | preview, edit, versions, test, delete | Email templates |
| `tableDocumentRequest` | view, start-review, approve, reject | Document review |
| `tableToggle` | enable/disable, edit, delete | Toggle-able items |
| `tableTimeEntry` | edit, delete | Time tracking |
| `tableDeliverable` | view, approve, reject, delete | Deliverables |
| `tableTask` | complete, edit, delete | Task management |
| `inlineSaveCancel` | save, cancel | Inline editing |
| `inlineEditDelete` | edit, delete | Inline actions |

## Additional React Hooks

### useButtonSet

Simplified hook for using predefined button sets:

```tsx
import { useButtonSet } from '@react/factories';

function MyTable({ data }) {
  const { renderSet } = useButtonSet({
    onClick: (action, id) => handleAction(action, id)
  });

  return data.map(row => (
    <td>{renderSet('tableCrud', row.id)}</td>
  ));
}
```

### useConditionalActions

For complex conditional action rendering:

```tsx
import { useConditionalActions } from '@react/factories';

function ReviewTable({ items }) {
  const { renderActions } = useConditionalActions({
    onAction: (action, id, row) => {
      if (action === 'approve') approveItem(id);
      if (action === 'reject') rejectItem(id);
    },
    actions: [
      { action: 'view' },
      { action: 'approve', show: (row) => row.status === 'pending' },
      { action: 'reject', show: (row) => row.status === 'pending' },
      { action: 'delete', disabled: (row) => row.isProtected }
    ]
  });

  return items.map(row => <td>{renderActions(row)}</td>);
}
```

### useActionHandlers

Create unified action handlers from individual handlers:

```tsx
import { useActionHandlers, useTableActions } from '@react/factories';

function MyTable({ data }) {
  const handleAction = useActionHandlers({
    handlers: {
      view: (id) => openDetail(id),
      edit: (id) => openEditModal(id),
      delete: (id) => confirmDelete(id)
    }
  });

  const { renderActions } = useTableActions({
    onAction: handleAction,
    actions: [
      { action: 'view' },
      { action: 'edit' },
      { action: 'delete' }
    ]
  });

  return data.map(row => <td>{renderActions(row.id, row)}</td>);
}
```

## Best Practices

1. **Use actions over icons** - Actions provide consistent titles and aria-labels
2. **Specify context** - Use appropriate context for sizing (table, modal, etc.)
3. **Use button sets** - For common patterns, use predefined sets
4. **Use conditional hooks** - For complex show/hide logic, use `useConditionalActions`
5. **Keep icons small** - Only import icons you can't express as actions
6. **Migrate gradually** - Legacy components still work, migrate over time
