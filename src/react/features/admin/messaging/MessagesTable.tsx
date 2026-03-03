import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Inbox,
  User,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
  AdminTableError,
} from '@react/components/portal/AdminTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

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

export function MessagesTable({ onNavigate, getAuthToken, showNotification, defaultPageSize = 25, overviewMode = false }: MessagesTableProps) {
  const containerRef = useFadeIn();

  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MESSAGES_CONVERSATIONS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      const payload = data.data || data;
      setConversations(payload.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = useMemo(() => {
    let result = conversations.filter(c => !c.isArchived);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.clientName.toLowerCase().includes(query) ||
          c.projectName?.toLowerCase().includes(query) ||
          c.lastMessage?.toLowerCase().includes(query)
      );
    }

    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'client': aVal = a.clientName; bVal = b.clientName; break;
          case 'unread': aVal = a.unreadCount; bVal = b.unreadCount; break;
          case 'lastMessageAt':
            aVal = a.lastMessageAt || '';
            bVal = b.lastMessageAt || '';
            break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [conversations, searchQuery, sort]);

  const pagination = usePagination({
    totalItems: filteredConversations.length,
    storageKey: overviewMode ? undefined : 'admin_messages_table_pagination',
    defaultPageSize,
  });

  const paginatedConversations = filteredConversations.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const hasActiveFilters = Boolean(searchQuery);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="MESSAGES"
      stats={
        <TableStats
          items={[
            { value: conversations.filter(c => !c.isArchived).length, label: 'conversations' },
            { value: totalUnread, label: 'unread', variant: 'pending', hideIfZero: true },
          ]}
          tooltip={`${conversations.length} Conversations • ${totalUnread} Unread`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
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
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </AdminTableHead>
            <AdminTableHead>Project</AdminTableHead>
            <AdminTableHead>Last Message</AdminTableHead>
            <AdminTableHead
              className="text-center"
              sortable
              sortDirection={sort?.column === 'unread' ? sort.direction : null}
              onClick={() => toggleSort('unread')}
            >
              Unread
            </AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'lastMessageAt' ? sort.direction : null}
              onClick={() => toggleSort('lastMessageAt')}
            >
              Last Updated
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading && !error}>
          {error ? (
            <AdminTableError colSpan={6} message={error} onRetry={loadConversations} />
          ) : isLoading ? (
            <AdminTableLoading colSpan={6} rows={5} />
          ) : paginatedConversations.length === 0 ? (
            <AdminTableEmpty
              colSpan={6}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No conversations match your search' : 'No conversations yet'}
            />
          ) : (
            paginatedConversations.map((conversation) => (
              <AdminTableRow
                key={conversation.id}
                clickable
                onClick={() => onNavigate?.('messages', String(conversation.id))}
              >
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <User className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{conversation.clientName}</span>
                      <span className="cell-subtitle">{conversation.clientEmail}</span>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
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
                </AdminTableCell>
                <AdminTableCell className="message-preview-cell">
                  <span className="text-truncate">{conversation.lastMessage || '—'}</span>
                </AdminTableCell>
                <AdminTableCell className="text-center">
                  {conversation.unreadCount > 0 && (
                    <span className="badge badge-pending">{conversation.unreadCount}</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  {conversation.lastMessageAt ? formatDate(conversation.lastMessageAt) : '—'}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="view"
                      title="Open Conversation"
                      onClick={() => onNavigate?.('messages', String(conversation.id))}
                    />
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
    </TableLayout>
  );
}

export default MessagesTable;
