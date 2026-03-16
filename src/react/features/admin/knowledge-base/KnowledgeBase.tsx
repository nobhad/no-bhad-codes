import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { LoadingState } from '@react/factories';

// Lazy load child components
const CategoriesTable = React.lazy(() => import('./CategoriesTable').then(m => ({ default: m.CategoriesTable })));
const ArticlesTable = React.lazy(() => import('./ArticlesTable').then(m => ({ default: m.ArticlesTable })));

interface KnowledgeBaseProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type KBSubtab = 'overview' | 'categories' | 'articles';

export function KnowledgeBase({ onNavigate, getAuthToken, showNotification }: KnowledgeBaseProps) {
  const containerRef = useFadeIn();
  const [activeSubtab, setActiveSubtab] = useState<KBSubtab>('overview');

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as KBSubtab;
      if (['overview', 'categories', 'articles'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('knowledgeBaseSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('knowledgeBaseSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Individual subtab views
  if (activeSubtab === 'categories') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading categories..." />}>
        <CategoriesTable
          onNavigate={onNavigate}
          getAuthToken={getAuthToken}
          showNotification={showNotification}
        />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'articles') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading articles..." />}>
        <ArticlesTable
          onNavigate={onNavigate}
          getAuthToken={getAuthToken}
          showNotification={showNotification}
        />
      </React.Suspense>
    );
  }

  // Overview - show all tables stacked with default pagination of 10
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <React.Suspense fallback={<LoadingState message="Loading categories..." />}>
        <section className="overview-table-section">
          <CategoriesTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>

      <React.Suspense fallback={<LoadingState message="Loading articles..." />}>
        <section className="overview-table-section">
          <ArticlesTable
            onNavigate={onNavigate}
            getAuthToken={getAuthToken}
            showNotification={showNotification}
            defaultPageSize={10}
            overviewMode
          />
        </section>
      </React.Suspense>
    </div>
  );
}
