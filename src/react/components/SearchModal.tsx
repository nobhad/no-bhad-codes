/**
 * ===============================================
 * SEARCH MODAL (Cmd+K)
 * ===============================================
 * @file src/react/components/SearchModal.tsx
 *
 * Global search modal with keyboard navigation,
 * grouped results by entity type, and relevance
 * scoring. Opens via Cmd+K (Mac) / Ctrl+K (Windows).
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, Briefcase, Users, Mail, FileText,
  ScrollText, ClipboardList, UserPlus, CheckSquare, File, X
} from 'lucide-react';
import { apiFetch } from '@/utils/api-client';

// ============================================
// Constants
// ============================================

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_KEY = 'portal_recent_searches';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  project: <Briefcase size={16} />,
  client: <Users size={16} />,
  message: <Mail size={16} />,
  invoice: <FileText size={16} />,
  proposal: <ScrollText size={16} />,
  contract: <ClipboardList size={16} />,
  lead: <UserPlus size={16} />,
  task: <CheckSquare size={16} />,
  file: <File size={16} />
};

const TYPE_LABELS: Record<string, string> = {
  project: 'Projects',
  client: 'Clients',
  message: 'Messages',
  invoice: 'Invoices',
  proposal: 'Proposals',
  contract: 'Contracts',
  lead: 'Leads',
  task: 'Tasks',
  file: 'Files'
};

// ============================================
// Types
// ============================================

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  path: string;
  relevanceScore: number;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

// ============================================
// Component
// ============================================

export function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setResults(json.data?.results || json.results || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }, [performSearch]);

  // Group results by type
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    return groups;
  }, [results]);

  // Flat list for keyboard nav
  const flatResults = useMemo(() => {
    const flat: SearchResult[] = [];
    for (const type of Object.keys(grouped)) {
      flat.push(...grouped[type]);
    }
    return flat;
  }, [grouped]);

  // Navigate to result
  const handleSelect = useCallback((result: SearchResult) => {
    // Save to recent searches
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const recent: string[] = stored ? JSON.parse(stored) : [];
      const updated = [query, ...recent.filter(r => r !== query)].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    navigate(result.path);
    onClose();
  }, [navigate, onClose, query]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        handleSelect(flatResults[selectedIndex]);
      }
      break;
    case 'Escape':
      onClose();
      break;
    }
  }, [flatResults, selectedIndex, handleSelect, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <div className="search-modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="search-modal">
        {/* Input */}
        <div className="search-modal-input-row">
          <Search size={18} className="search-modal-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Search projects, clients, invoices..."
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="search-modal-close" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="search-modal-results">
          {loading && (
            <div className="search-modal-loading">Searching...</div>
          )}

          {!loading && query && flatResults.length === 0 && (
            <div className="search-modal-empty">No results found</div>
          )}

          {!loading && Object.keys(grouped).map(type => (
            <div key={type} className="search-modal-group">
              <div className="search-modal-group-label">
                {TYPE_ICONS[type]}
                <span>{TYPE_LABELS[type] || type}</span>
              </div>
              {grouped[type].map(result => {
                const flatIndex = flatResults.indexOf(result);
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={`search-modal-result ${flatIndex === selectedIndex ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                  >
                    <span className="search-modal-result-title">{result.title}</span>
                    <span className="search-modal-result-subtitle">{result.subtitle}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Hint */}
          {!query && (
            <div className="search-modal-hint">
              Type to search across all entities
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="search-modal-footer">
          <span className="search-modal-shortcut">ESC</span> to close
          <span className="search-modal-shortcut">↑↓</span> to navigate
          <span className="search-modal-shortcut">↵</span> to select
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Hook to manage Cmd+K / Ctrl+K search shortcut.
 */
export function useSearchModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false)
  };
}
