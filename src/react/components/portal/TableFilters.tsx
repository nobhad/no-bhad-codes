import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { KEYS } from '../../../constants/keyboard';

/**
 * SearchFilter
 * Icon-button search with collapsible dropdown.
 */
export interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchFilter({ value, onChange, placeholder = 'Search...' }: SearchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div
      ref={ref}
      className={cn('filter-search-wrapper', isOpen && 'open', value && 'has-value')}
    >
      {!isOpen && (
        <button
          type="button"
          className={cn('icon-btn filter-search-trigger', value && 'has-value')}
          onClick={() => setIsOpen(true)}
          title="Search"
          aria-label={placeholder || 'Search'}
        >
          <Search />
        </button>
      )}
      {isOpen && (
        <div className="filter-search-dropdown">
          <Search className="search-bar-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="search-bar-input"
            data-shortcut="search"
            aria-label={placeholder || 'Search'}
            onKeyDown={(e) => {
              if (e.key === KEYS.ESCAPE) setIsOpen(false);
            }}
          />
          {value && (
            <button
              type="button"
              className="search-bar-clear"
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              title="Clear search"
            >
              <X />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * FilterDropdown
 * Icon-button filter with dropdown menu.
 */
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSection {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface FilterDropdownProps {
  sections: FilterSection[];
  values: Record<string, string[]>;
  onChange: (key: string, value: string) => void;
}

export function FilterDropdown({ sections, values, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  // Count sections with at least one active filter
  const activeCount = Object.values(values).filter(arr => Array.isArray(arr) && arr.length > 0).length;

  // Position the portal menu below the trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 'var(--z-index-portal-dropdown, 9700)' as unknown as number
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className={cn('filter-dropdown-wrapper', isOpen && 'open')}>
      <button
        ref={triggerRef}
        type="button"
        className={cn('icon-btn filter-dropdown-trigger', activeCount > 0 && 'has-value')}
        onClick={() => setIsOpen(!isOpen)}
        title="Filter"
        aria-label="Filter options"
      >
        <Filter />
        {activeCount > 0 && (
          <span className="filter-count-badge visible">{activeCount}</span>
        )}
      </button>
      {isOpen && createPortal(
        <div ref={menuRef} className="filter-dropdown-menu portal-mounted" style={menuStyle}>
          {sections.map((section) => {
            const selected = values[section.key] ?? [];
            const noneSelected = selected.length === 0;
            return (
              <div key={section.key} className="filter-section">
                <div className="filter-section-label field-label">{section.label}</div>
                <div className="filter-options">
                  {section.options.map((option) => {
                    const isAll = option.value === 'all';
                    const isActive = isAll ? noneSelected : selected.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn('filter-option', isActive && 'is-active')}
                        onClick={() => onChange(section.key, option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * ExportButton
 * Icon-button for CSV/PDF export.
 */
export interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
}

export function ExportButton({ onClick, disabled, icon, title = 'Export' }: ExportButtonProps) {
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {icon || <span>Export</span>}
    </button>
  );
}
