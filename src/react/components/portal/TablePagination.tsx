import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

export interface TablePaginationProps {
  pageInfo: string;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  canGoPrev: boolean;
  canGoNext: boolean;
  onPageSizeChange: (size: number) => void;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
}

/**
 * Unified table pagination component matching vanilla admin table styling.
 * Use this in all React admin tables for consistent pagination UI.
 */
export function TablePagination({
  pageInfo,
  page,
  pageSize,
  pageSizeOptions,
  canGoPrev,
  canGoNext,
  onPageSizeChange,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
}: TablePaginationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="table-pagination">
      <div className="pagination-inner">
        <div className="pagination-info">
          Showing {pageInfo}
        </div>

        <div className="pagination-controls">
          <div className="pagination-size" ref={dropdownRef}>
            <label>Per page:</label>
            <div className="pagination-page-size-dropdown">
              <div className={`table-dropdown custom-dropdown ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="custom-dropdown-trigger"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <span className="custom-dropdown-text">{pageSize}</span>
                  <ChevronDown className="custom-dropdown-caret" />
                </button>
                <ul className="custom-dropdown-menu">
                  {pageSizeOptions.map((size) => (
                    <li
                      key={size}
                      className="custom-dropdown-item"
                      onClick={() => {
                        onPageSizeChange(size);
                        setIsOpen(false);
                      }}
                    >
                      {size}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pagination-nav">
            <button
              type="button"
              className="pagination-btn"
              onClick={onFirstPage}
              disabled={!canGoPrev}
              title="First page"
            >
              <ChevronsLeft />
            </button>
            <button
              type="button"
              className="pagination-btn"
              onClick={onPrevPage}
              disabled={!canGoPrev}
              title="Previous page"
            >
              <ChevronLeft />
            </button>

            <span className="pagination-page-btn active">
              {page}
            </span>

            <button
              type="button"
              className="pagination-btn"
              onClick={onNextPage}
              disabled={!canGoNext}
              title="Next page"
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              className="pagination-btn"
              onClick={onLastPage}
              disabled={!canGoNext}
              title="Last page"
            >
              <ChevronsRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to create TablePagination props from usePagination hook result.
 */
export function paginationToProps(pagination: {
  pageInfo: string;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  canGoPrev: boolean;
  canGoNext: boolean;
  setPageSize: (size: number) => void;
  firstPage: () => void;
  prevPage: () => void;
  nextPage: () => void;
  lastPage: () => void;
}): TablePaginationProps {
  return {
    pageInfo: pagination.pageInfo,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageSizeOptions: pagination.pageSizeOptions,
    canGoPrev: pagination.canGoPrev,
    canGoNext: pagination.canGoNext,
    onPageSizeChange: pagination.setPageSize,
    onFirstPage: pagination.firstPage,
    onPrevPage: pagination.prevPage,
    onNextPage: pagination.nextPage,
    onLastPage: pagination.lastPage,
  };
}
