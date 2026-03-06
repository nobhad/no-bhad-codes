import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  User
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

interface Conversation {
  id: number;
  clientId: number;
  clientName: string;
  clientEmail: string;
  projectId?: number;
  projectName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isStarred: boolean;
  isArchived: boolean;
}

interface MessagesTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

function filterConversation(
  conversation: Conversation,
  _filters: Record<string, string>,
  search: string
): boolean {
  // Always exclude archived
  if (conversation.isArchived) return false;

  if (search) {
    const query = search.toLowerCase();
    if (
      !conversation.clientName.toLowerCase().includes(query) &&
      !conversation.projectName?.toLowerCase().includes(query) &&
      !conversation.lastMessage?.toLowerCase().includes(query)
    ) {
      return false;
    }
  }
  return true;
}

function sortConversations(a: Conversation, b: Conversation, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'client':
    return multiplier * a.clientName.localeCompare(b.clientName);
  case 'unread':
    return multiplier * (a.unreadCount - b.unreadCount);
  case 'lastMessageAt': {
    const aVal = a.lastMessageAt || '';
    const bVal = b.lastMessageAt || '';
    return multiplier * aVal.localeCompare(bVal);
  }
  default:
    return 0;
  }
}

export function MessagesTable({ onNavigate, getAuthToken, defaultPageSize = 25, overviewMode = false }: MessagesTableProps) {
  const containerRef = useFadeIn();

  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const {
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Conversation>({
    storageKey: overviewMode ? undefined : 'admin_messages',
    filters: [],
    filterFn: filterConversation,
    sortFn: sortConversations
  });

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setConversations((data.conversations as Conversation[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = useMemo(() => applyFilters(conversations), [applyFilters, conversations]);

  const pagination = usePagination({
    totalItems: filteredConversations.length,
    storageKey: overviewMode ? undefined : 'admin_messages_table_pagination',
    defaultPageSize
  });

  const paginatedConversations = filteredConversations.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="MESSAGES"
      stats={
        <TableStats
          items={[
            { value: conversations.filter(c => !c.isArchived).length, label: 'conversations' },
            { value: totalUnread, label: 'unread', variant: 'pending', hideIfZero: true }
          ]}
          tooltip={`${conversations.length} Conversations • ${totalUnread} Unread`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search messages..."
          />
          <IconButton action="refresh" onClick={loadConversations} disabled={isLoading} title="Refresh" />
        </>
      }
      pagination={
        !isLoading && filteredConversations.length > 0 ? (
          <TablePagination
            pageInfo={pagination.pageInfo}
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPageSizeChange={pagination.setPageSize}
            onFirstPage={pagination.firstPage}
            onPrevPage={pagination.prevPage}
            onNextPage={pagination.nextPage}
            onLastPage={pagination.lastPage}
          />
        ) : undefined
      }
    >
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </PortalTableHead>
            <PortalTableHead>Project</PortalTableHead>
            <PortalTableHead>Last Message</PortalTableHead>
            <PortalTableHead
              className="text-center"
              sortable
              sortDirection={sort?.column === 'unread' ? sort.direction : null}
              onClick={() => toggleSort('unread')}
            >
              Unread
            </PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'lastMessageAt' ? sort.direction : null}
              onClick={() => toggleSort('lastMessageAt')}
            >
              Last Updated
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={6} message={error} onRetry={loadConversations} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={6} rows={5} />
          ) : paginatedConversations.length === 0 ? (
            <PortalTableEmpty
              colSpan={6}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No conversations match your search' : 'No conversations yet'}
            />
          ) : (
            paginatedConversations.map((conversation) => (
              <PortalTableRow
                key={conversation.id}
                clickable
                onClick={() => onNavigate?.('messages', String(conversation.id))}
              >
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <User className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{conversation.clientName}</span>
                      <span className="cell-subtitle">{conversation.clientEmail}</span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  {conversation.projectName && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('projects', conversation.projectId != null ? String(conversation.projectId) : undefined);
                      }}
                      className="cell-link-btn"
                    >
                      {conversation.projectName}
                    </button>
                  )}
                </PortalTableCell>
                <PortalTableCell className="message-preview-cell">
                  {conversation.lastMessage
                    ? <span className="text-truncate">{conversation.lastMessage}</span>
                    : null
                  }
                </PortalTableCell>
                <PortalTableCell className="text-center">
                  {conversation.unreadCount > 0 && (
                    <span className="badge badge-pending">{conversation.unreadCount}</span>
                  )}
                </PortalTableCell>
                <PortalTableCell className="date-cell">
                  {conversation.lastMessageAt
                    ? formatDate(conversation.lastMessageAt)
                    : null
                  }
                </PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="view"
                      title="Open Conversation"
                      onClick={() => onNavigate?.('messages', String(conversation.id))}
                    />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}

export default MessagesTable;
