import { useCallback, useState } from 'react';
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

  const exportCsv = useCallback(() => {
    if (data.length === 0) return;

    setIsExporting(true);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        // Cast to Record<string, unknown>[] since exportToCsv expects that type
        exportToCsv(data as unknown as Record<string, unknown>[], config);
        onExport?.(data.length);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [data, config, onExport]);

  return {
    exportCsv,
    isExporting
  };
}

// Re-export configs for convenience
export { PROJECTS_EXPORT_CONFIG, LEADS_EXPORT_CONFIG } from '../../utils/table-export';
export type { ExportConfig, ExportColumn } from '../../utils/table-export';
