/**
 * ===============================================
 * DATA QUALITY SERVICE
 * ===============================================
 * Database operations for data quality features:
 * duplicate resolution, validation error logs,
 * metrics storage, and security threat logging.
 */

import { getDatabase } from '../database/init.js';
import {
  DUPLICATE_DETECTION_LOG_COLUMNS,
  DUPLICATE_RESOLUTION_LOG_COLUMNS,
  DATA_QUALITY_METRICS_COLUMNS,
  VALIDATION_ERROR_LOG_COLUMNS
} from '../routes/data-quality/shared.js';

// ============================================
// Interfaces
// ============================================

interface DuplicateDismissParams {
  primaryId: number;
  primaryType: string;
  dismissedId: number;
  dismissedType: string;
  resolvedBy: string;
  resolvedByUserId: number | null;
  notes: string | null;
}

interface DuplicateDetectionLogRow {
  id: number;
  scan_type: string;
  entity_type: string;
  source_id: number;
  source_type: string;
  duplicates_found: number;
  matches_json: string;
  threshold_used: number;
  scanned_by: string;
  scan_duration_ms: number;
  created_at: string;
}

interface DuplicateResolutionLogRow {
  id: number;
  detection_log_id: number | null;
  primary_record_id: number;
  primary_record_type: string;
  merged_record_id: number;
  merged_record_type: string;
  resolution_type: string;
  fields_merged: string | null;
  resolved_by: string;
  notes: string | null;
  created_at: string;
}

interface StoreMetricsParams {
  metricDate: string;
  totalRecords: number;
  duplicateCount: number;
  qualityScore: number;
  detailsJson: string;
}

interface MetricsHistoryRow {
  id: number;
  metric_date: string;
  entity_type: string;
  total_records: number;
  valid_emails: number;
  valid_phones: number;
  complete_records: number;
  duplicate_count: number;
  quality_score: number;
  details_json: string;
  created_at: string;
}

interface ValidationErrorLogRow {
  id: number;
  entity_type: string;
  entity_id: number | null;
  field_name: string;
  field_value: string;
  error_type: string;
  error_message: string;
  was_sanitized: number | boolean;
  sanitized_value: string | null;
  source_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface SecurityThreatLogParams {
  inputValue: string;
  errorType: string;
  errorMessage: string;
  sourceIp: string | undefined;
  userAgent: string;
}

// ============================================
// Service
// ============================================

class DataQualityService {
  /**
   * Insert a duplicate dismissal into the resolution log
   */
  async dismissDuplicate(params: DuplicateDismissParams): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO duplicate_resolution_log (primary_record_id, primary_record_type, merged_record_id, merged_record_type, resolution_type, resolved_by, resolved_by_user_id, notes)
       VALUES (?, ?, ?, ?, 'mark_not_duplicate', ?, ?, ?)`,
      [
        params.primaryId,
        params.primaryType,
        params.dismissedId,
        params.dismissedType,
        params.resolvedBy,
        params.resolvedByUserId,
        params.notes
      ]
    );
  }

  /**
   * Get detection and resolution logs for duplicate history
   */
  async getDuplicateHistory(): Promise<{
    detectionLogs: DuplicateDetectionLogRow[];
    resolutionLogs: DuplicateResolutionLogRow[];
  }> {
    const db = getDatabase();
    const [detectionLogs, resolutionLogs] = await Promise.all([
      db.all<DuplicateDetectionLogRow>(
        `SELECT ${DUPLICATE_DETECTION_LOG_COLUMNS} FROM duplicate_detection_log ORDER BY created_at DESC LIMIT 100`
      ),
      db.all<DuplicateResolutionLogRow>(
        `SELECT ${DUPLICATE_RESOLUTION_LOG_COLUMNS} FROM duplicate_resolution_log ORDER BY created_at DESC LIMIT 100`
      )
    ]);

    return { detectionLogs, resolutionLogs };
  }

  /**
   * Get validation error logs with optional filtering
   */
  async getValidationErrors(options: {
    errorType?: string;
    limit?: number;
  }): Promise<ValidationErrorLogRow[]> {
    const db = getDatabase();
    let query = `SELECT ${VALIDATION_ERROR_LOG_COLUMNS} FROM validation_error_log`;
    const params: (string | number)[] = [];

    if (options.errorType) {
      query += ' WHERE error_type = ?';
      params.push(options.errorType);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(options.limit ?? 100);

    return db.all<ValidationErrorLogRow>(query, params);
  }

  /**
   * Store calculated quality metrics
   */
  async storeMetrics(params: StoreMetricsParams): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT OR REPLACE INTO data_quality_metrics (metric_date, entity_type, total_records, duplicate_count, quality_score, details_json)
       VALUES (?, 'duplicates', ?, ?, ?, ?)`,
      [
        params.metricDate,
        params.totalRecords,
        params.duplicateCount,
        params.qualityScore,
        params.detailsJson
      ]
    );
  }

  /**
   * Get historical metrics for the given number of days
   */
  async getMetricsHistory(days: number): Promise<MetricsHistoryRow[]> {
    const db = getDatabase();
    return db.all<MetricsHistoryRow>(
      `SELECT ${DATA_QUALITY_METRICS_COLUMNS} FROM data_quality_metrics
       WHERE metric_date > date('now', '-' || ? || ' days')
       ORDER BY metric_date DESC, entity_type
       LIMIT 1000`,
      [Number(days)]
    );
  }

  /**
   * Log a security threat detection to the validation error log
   */
  async logSecurityThreat(params: SecurityThreatLogParams): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO validation_error_log (entity_type, field_name, field_value, error_type, error_message, source_ip, user_agent)
       VALUES ('security_check', 'input', ?, ?, ?, ?, ?)`,
      [
        params.inputValue,
        params.errorType,
        params.errorMessage,
        params.sourceIp,
        params.userAgent
      ]
    );
  }
}

export const dataQualityService = new DataQualityService();
