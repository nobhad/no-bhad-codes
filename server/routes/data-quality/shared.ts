/**
 * ===============================================
 * DATA QUALITY — SHARED
 * ===============================================
 * Constants and helper values used by all
 * data-quality sub-routers.
 */

// Explicit column lists for SELECT queries (avoid SELECT *)
export const DUPLICATE_DETECTION_LOG_COLUMNS = `
  id, scan_type, entity_type, source_id, source_type, duplicates_found,
  matches_json, threshold_used, scanned_by, scan_duration_ms, created_at
`.replace(/\s+/g, ' ').trim();

export const DUPLICATE_RESOLUTION_LOG_COLUMNS = `
  id, detection_log_id, primary_record_id, primary_record_type, merged_record_id,
  merged_record_type, resolution_type, fields_merged, resolved_by, notes, created_at
`.replace(/\s+/g, ' ').trim();

export const DATA_QUALITY_METRICS_COLUMNS = `
  id, metric_date, entity_type, total_records, valid_emails, valid_phones,
  complete_records, duplicate_count, quality_score, details_json, created_at
`.replace(/\s+/g, ' ').trim();

export const VALIDATION_ERROR_LOG_COLUMNS = `
  id, entity_type, entity_id, field_name, field_value, error_type,
  error_message, was_sanitized, sanitized_value, source_ip, user_agent, created_at
`.replace(/\s+/g, ' ').trim();
