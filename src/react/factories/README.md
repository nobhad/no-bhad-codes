# React Factories

State-of-the-art factory system for React components.

## Mount Factories

### Before (39 lines per file)

```typescript
// mount.tsx - Old verbose pattern
import { createTableMount, type TableMountOptions } from '@/react/factories/createTableMount';
import { ClientsTable } from './ClientsTable';

export interface ClientsMountOptions extends TableMountOptions {
  getAuthToken?: () => string | null;
  onViewClient?: (clientId: number) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const { mount, unmount } = createTableMount<ClientsMountOptions>(ClientsTable, 'ClientsTable');

export function mountClientsTable(
  container: HTMLElement | string,
  options: ClientsMountOptions = {}
): () => void {
  const element =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!element) {
    console.error('[mountClientsTable] Container not found:', container);
    return () => {};
  }

  return mount(element, options);
}

export const unmountClientsTable = unmount;

export function shouldUseReactClientsTable(): boolean {
  return true;
}
```

### After (12 lines per file)

```typescript
// mount.tsx - New streamlined pattern
import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { ClientsTable } from './ClientsTable';

export interface ClientsMountOptions extends BaseMountOptions {
  onViewClient?: (clientId: number) => void;
}

export const {
  mount: mountClientsTable,
  unmount: unmountClientsTable,
  shouldUseReact: shouldUseReactClientsTable
} = createMountWrapper<ClientsMountOptions>({
  Component: ClientsTable,
  displayName: 'ClientsTable'
});
```

## Hook Factories

### useBulkAction - Standardized Bulk Operations

Before (25+ lines per bulk action):

```typescript
// Old verbose pattern - repeated in every table
const handleBulkMarkPaid = useCallback(async () => {
  if (selection.selectedCount === 0) return;

  const ids = selection.selectedItems.map((i) => i.id);
  const result = await bulkMarkPaid(ids);

  selection.clearSelection();

  if (result.failed === 0) {
    showNotification?.(
      `Marked ${result.success} invoice${result.success !== 1 ? 's' : ''} as paid`,
      'success'
    );
  } else if (result.success > 0) {
    showNotification?.(`Partial success: ${result.success} marked, ${result.failed} failed`, 'warning');
  } else {
    showNotification?.('Failed to mark invoices as paid', 'error');
  }

  refetch();
}, [selection, bulkMarkPaid, showNotification, refetch]);
```

After (5 lines per bulk action):

```typescript
// New streamlined pattern
const { isLoading, createBulkHandler } = useBulkAction({
  selection,
  showNotification,
  refetch
});

const handleBulkMarkPaid = createBulkHandler({
  actionName: 'mark as paid',
  confirmMessage: 'Mark selected invoices as paid?',
  operation: bulkMarkPaid,
  successMessage: (result) => `Marked ${result.success} invoice${result.success !== 1 ? 's' : ''} as paid`,
  errorMessage: 'Failed to mark invoices as paid'
});

// Or use presets
const handleBulkDelete = createBulkHandler(BULK_ACTION_PRESETS.delete(bulkDelete));
const handleBulkArchive = createBulkHandler(BULK_ACTION_PRESETS.archive(bulkArchive));
```

### useTableActions - Simplified Action Rendering

Before:

```typescript
<AdminTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
  <div className="table-actions">
    <IconButton
      action="view"
      onClick={() => handleViewClient(client.id)}
      title="View client"
    />
    {inviteStatus === 'not-invited' && (
      <IconButton
        action="send"
        onClick={() => handleSendInvite(client.id)}
        disabled={inviteLoading === client.id}
        title="Send invitation"
      />
    )}
    {client.phone && (
      <IconButton
        action="call"
        onClick={() => window.location.href = `tel:${client.phone}`}
        title="Call client"
      />
    )}
  </div>
</AdminTableCell>
```

After:

```typescript
const { renderActions } = useConditionalActions({
  onAction: (action, id, row) => {
    switch (action) {
      case 'view': handleViewClient(id); break;
      case 'send': handleSendInvite(id); break;
      case 'call': window.location.href = `tel:${row.phone}`; break;
    }
  },
  actions: [
    { action: 'view' },
    { action: 'send', show: (row) => row.inviteStatus === 'not-invited', disabled: (row) => inviteLoading === row.id },
    { action: 'call', show: (row) => Boolean(row.phone) }
  ]
});

// In render:
<AdminTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
  {renderActions(client)}
</AdminTableCell>
```

### useDataFetch - Standardized API Fetching

```typescript
const { data, isLoading, error, refetch } = useDataFetch({
  getAuthToken,
  fetchFn: async (_, headers) => {
    const response = await fetch('/api/admin/clients', { headers, credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load clients');
    return response.json();
  },
  onSuccess: (data) => setStats(data.stats),
  initialData: { clients: [], stats: defaultStats }
});
```

Or use the convenience hook:

```typescript
const { data, isLoading, error, refetch } = useListFetch<Client, ClientStats>({
  endpoint: '/api/admin/clients',
  getAuthToken,
  defaultStats: { total: 0, active: 0 },
  itemsKey: 'clients'
});

// data.items = Client[]
// data.stats = ClientStats
```

### useCrud - CRUD Operations

```typescript
const { create, update, remove } = useCrud<Client>({
  endpoint: '/api/admin/clients',
  getAuthToken,
  showNotification,
  itemName: 'Client'
});

// Usage
await create({ name: 'New Client', email: 'new@example.com' });
await update(clientId, { name: 'Updated Name' });
await remove(clientId);
```

## Component Factories

### IconButton

```typescript
import { IconButton } from '@/react/factories';

// Using predefined actions (auto-title, auto-icon)
<IconButton action="edit" onClick={handleEdit} />
<IconButton action="delete" onClick={handleDelete} />
<IconButton action="view" onClick={handleView} />

// Using custom icon
<IconButton icon="settings" onClick={handleSettings} />
```

### StatusBadge

```typescript
import { StatusBadge, getStatusVariant } from '@/react/factories';

<StatusBadge status={getStatusVariant(invoice.status)} size="sm">
  {invoice.status}
</StatusBadge>
```

### StateDisplay

```typescript
import { EmptyState, LoadingState, ErrorState } from '@/react/factories';

{isLoading ? (
  <LoadingState message="Loading clients..." />
) : error ? (
  <ErrorState message={error} onRetry={refetch} />
) : clients.length === 0 ? (
  <EmptyState message="No clients yet" icon={<Users />} />
) : (
  <ClientsList clients={clients} />
)}
```

## Factory Constants

```typescript
import { BUTTON_ACTIONS, BUTTON_SETS, UI_CONTEXTS } from '@/react/factories';

// 143+ predefined button actions
BUTTON_ACTIONS.edit  // { icon: 'edit', title: 'Edit', ariaLabel: 'Edit item' }
BUTTON_ACTIONS.delete // { icon: 'trash', title: 'Delete', ariaLabel: 'Delete item', variant: 'danger' }

// 30+ predefined button combinations
BUTTON_SETS.tableCrud(id) // View, Edit, Delete for a table row
BUTTON_SETS.confirm() // Save, Cancel
BUTTON_SETS.modal() // Close
```
