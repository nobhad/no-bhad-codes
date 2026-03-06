import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@react/lib/utils';

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
      <button
        type="button"
        className={cn('icon-btn filter-search-trigger', value && 'has-value')}
        onClick={() => setIsOpen(!isOpen)}
        title="Search"
        aria-label={placeholder || 'Search'}
      >
        <Search />
      </button>
      <div className="filter-search-dropdown search-bar">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="search-bar-input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
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
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterDropdown({ sections, values, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Count active filters (non-'all' values)
  const activeCount = Object.values(values).filter(v => v && v !== 'all').length;

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

  return (
    <div
      ref={ref}
      className={cn('filter-dropdown-wrapper', isOpen && 'open')}
    >
      <button
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
      <div className="filter-dropdown-menu">
        {sections.map((section) => (
          <div key={section.key} className="filter-section">
            <div className="filter-section-label field-label">{section.label}</div>
            <div className="filter-options">
              {section.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'filter-option',
                    (values[section.key] || 'all') === option.value && 'active'
                  )}
                  onClick={() => {
                    onChange(section.key, option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
    >
      {icon || <span>Export</span>}
    </button>
  );
}
