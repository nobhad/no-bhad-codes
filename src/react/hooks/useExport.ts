import { useCallback, useRef, useEffect, useState } from 'react';
import { exportToCsv, type ExportConfig } from '../../utils/table-export';

interface UseExportOptions<T> {
  /** Export configuration */
  config: ExportConfig;
  /** Data to export */
  data: T[];
  /** Callback after export */
  onExport?: (count: number) => void;
}

interface UseExportReturn {
  /** Export data to CSV */
  exportCsv: () => void;
  /** Whether export is in progress */
  isExporting: boolean;
}

/**
 * useExport
 * Hook for exporting table data to CSV
 */
export function useExport<T extends object>({
  config,
  data,
  onExport
}: UseExportOptions<T>): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const exportCsv = useCallback(() => {
    if (data.length === 0) return;

    setIsExporting(true);

    // Use setTimeout to allow UI to update
    timerRef.current = setTimeout(() => {
      try {
        // Cast to Record<string, unknown>[] since exportToCsv expects that type
        exportToCsv(data as unknown as Record<string, unknown>[], config);
        onExport?.(data.length);
      } finally {
        setIsExporting(false);
        timerRef.current = null;
      }
    }, 100);
  }, [data, config, onExport]);

  return {
    exportCsv,
    isExporting
  };
}

// Re-export configs for convenience
export {
  CLIENTS_EXPORT_CONFIG,
  CONTACTS_EXPORT_CONFIG,
  CONTRACTS_EXPORT_CONFIG,
  INVOICES_EXPORT_CONFIG,
  LEADS_EXPORT_CONFIG,
  PROJECTS_EXPORT_CONFIG,
  PROPOSALS_EXPORT_CONFIG,
  DOCUMENT_REQUESTS_EXPORT_CONFIG,
  KNOWLEDGE_BASE_EXPORT_CONFIG,
  TIME_ENTRIES_EXPORT_CONFIG,
  QUESTIONNAIRES_EXPORT_CONFIG,
  WORKFLOWS_EXPORT_CONFIG,
  GLOBAL_TASKS_EXPORT_CONFIG,
  AD_HOC_REQUESTS_EXPORT_CONFIG,
  DELIVERABLES_EXPORT_CONFIG
} from '../../utils/table-export';
export type { ExportConfig, ExportColumn } from '../../utils/table-export';
