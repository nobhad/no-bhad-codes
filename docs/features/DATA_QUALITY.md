# Data Quality & Cleanup

**Status:** Complete
**Last Updated:** 2026-02-10

## Overview

The Data Quality system provides comprehensive tools for maintaining data integrity including duplicate detection, input validation, XSS prevention, and rate limiting to protect against abuse.

## Architecture

### Components

- `duplicate-detection-service.ts` - Levenshtein-based similarity matching
- `validation-service.ts` - Email, phone, URL, file validation
- `rate-limiter.ts` - API rate limiting middleware
- `data-quality.ts` - API routes for data quality operations

### Data Flow

1. **Duplicate Detection**
   - User triggers scan via API or automatic during intake
   - System calculates similarity scores using Levenshtein distance
   - Matches above threshold returned with confidence levels
   - Admin reviews and merges/dismisses duplicates

2. **Input Validation**
   - Request hits validation endpoint
   - Service validates format, detects threats
   - Returns validation result with sanitized value
   - Logs security threats for monitoring

3. **Rate Limiting**
   - Request arrives at protected endpoint
   - Middleware checks IP against cache/database
   - Allows or blocks based on rate limit config
   - Sets rate limit headers for client awareness

### Database Tables

- `duplicate_detection_log` - Scan history and results
- `duplicate_resolution_log` - Merge/dismiss decisions
- `validation_error_log` - Validation failures for auditing
- `data_quality_metrics` - Quality scores over time
- `rate_limit_log` - Rate limit events
- `blocked_ips` - Persistent IP blocks

## Implementation Details

### Duplicate Detection Algorithm

The system uses a weighted Levenshtein distance algorithm:

```typescript
// Field weights for similarity scoring
const FIELD_WEIGHTS = {
  email: 0.35,      // Email match is strongest indicator
  company: 0.25,   // Company name important for B2B
  name: 0.20,      // Names can be similar
  phone: 0.15,     // Phone less reliable
  domain: 0.05    // Domain from email
};

// Confidence thresholds
const THRESHOLDS = {
  exact: 1.0,      // 100% match
  high: 0.85,      // 85%+ match
  medium: 0.70,    // 70%+ match
  low: 0.50        // 50%+ match
};
```

### Validation Patterns

**Email Validation (RFC 5322 compliant):**

- Format validation with regex
- Length checks (max 254 chars, local part max 64)
- Domain validation
- Consecutive dot detection

**Phone Validation:**

- International format support
- Digit extraction and length validation
- Automatic formatting to +1-XXX-XXX-XXXX

**XSS Detection Patterns:**

```typescript
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // event handlers
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi
];
```

**SQL Injection Detection:**

```typescript
const SQL_INJECTION_PATTERNS = [
  /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION)/gi,
  /(--|;|\/\*|\*\/|@@|@|char\(|nchar\()/gi,
  /(OR|AND)\s+\d+\s*=\s*\d+/gi  // OR 1=1 style
];
```

### Rate Limiting Presets

```typescript
const RATE_LIMIT_PRESETS = {
  publicForm: {
    windowMs: 60_000,      // 1 minute
    maxRequests: 5,        // 5 per minute
    blockDurationMs: 300_000  // 5 min block
  },
  standard: {
    windowMs: 60_000,
    maxRequests: 60,
    blockDurationMs: 60_000
  },
  authenticated: {
    windowMs: 60_000,
    maxRequests: 120,
    blockDurationMs: 30_000
  },
  sensitive: {
    windowMs: 3_600_000,   // 1 hour
    maxRequests: 10,
    blockDurationMs: 3_600_000
  }
};
```

## API Endpoints

### Duplicate Detection

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data-quality/duplicates/scan` | Scan for duplicates |
| POST | `/api/data-quality/duplicates/check` | Check single record |
| POST | `/api/data-quality/duplicates/merge` | Merge duplicates |
| POST | `/api/data-quality/duplicates/dismiss` | Dismiss match |
| GET | `/api/data-quality/duplicates/history` | Get scan history |

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data-quality/validate/email` | Validate email |
| POST | `/api/data-quality/validate/phone` | Validate phone |
| POST | `/api/data-quality/validate/url` | Validate URL |
| POST | `/api/data-quality/validate/file` | Validate file |
| POST | `/api/data-quality/validate/object` | Validate object |
| POST | `/api/data-quality/sanitize` | Sanitize text |
| POST | `/api/data-quality/security/check` | Check for threats |

### Metrics & Administration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-quality/metrics` | Get quality metrics |
| POST | `/api/data-quality/metrics/calculate` | Trigger calculation |
| GET | `/api/data-quality/metrics/history` | Get metric history |
| GET | `/api/data-quality/rate-limits/stats` | Rate limit stats |
| POST | `/api/data-quality/rate-limits/block` | Block IP |
| POST | `/api/data-quality/rate-limits/unblock` | Unblock IP |
| GET | `/api/data-quality/validation-errors` | Get error logs |

## Usage Examples

### Scan for Duplicates

```typescript
// POST /api/data-quality/duplicates/scan
{
  "entityType": "all",      // "client", "lead", "intake", or "all"
  "threshold": 0.7,         // Minimum similarity (0-1)
  "limit": 100              // Max results
}

// Response
{
  "success": true,
  "data": {
    "duplicates": [
      {
        "id": 1,
        "type": "client",
        "name": "John Smith",
        "email": "john@company.com",
        "similarityScore": 0.92,
        "matchedFields": ["email", "name"],
        "confidence": "high"
      }
    ],
    "count": 1,
    "scanDuration": 156,
    "threshold": 0.7
  }
}
```

### Check During Intake

```typescript
// POST /api/data-quality/duplicates/check
{
  "email": "john.smith@company.com",
  "name": "John Smith",
  "company": "Company Inc",
  "phone": "555-1234"
}

// Response
{
  "success": true,
  "data": {
    "hasDuplicates": true,
    "duplicates": [...],
    "count": 2
  }
}
```

### Validate Form Object

```typescript
// POST /api/data-quality/validate/object
{
  "data": {
    "email": "test@example.com",
    "phone": "555-1234",
    "name": "John Doe"
  },
  "schema": {
    "email": { "type": "email", "required": true },
    "phone": { "type": "phone", "required": false },
    "name": { "type": "text", "required": true, "minLength": 2, "maxLength": 100 }
  }
}

// Response
{
  "success": true,
  "data": {
    "valid": true,
    "errors": {},
    "sanitized": {
      "email": "test@example.com",
      "phone": "+1-555-555-1234",
      "name": "John Doe"
    }
  }
}
```

### Block Malicious IP

```typescript
// POST /api/data-quality/rate-limits/block
{
  "ip": "192.168.1.100",
  "reason": "Repeated XSS attempts",
  "adminEmail": "admin@company.com",
  "expiresAt": "2026-02-17T00:00:00Z"  // Optional, null for permanent
}
```

## Testing

### Test Categories

1. **Duplicate Detection (15 tests)**
   - Levenshtein distance calculation
   - Similarity scoring with weights
   - Threshold filtering
   - Merge operations
   - History tracking

2. **Input Validation (20 tests)**
   - Email format validation
   - Phone number validation
   - URL validation
   - File type/size validation
   - Object schema validation

3. **Security Detection (12 tests)**
   - XSS pattern detection
   - SQL injection detection
   - Input sanitization
   - Null byte removal
   - Unicode normalization

4. **Rate Limiting (10 tests)**
   - Request counting
   - Window expiration
   - Blocking behavior
   - IP management
   - Statistics tracking

5. **Integration (8 tests)**
   - API endpoint responses
   - Database logging
   - Error handling
   - Concurrent requests
**Total: 65 tests**

## Security Considerations

### Rate Limiting Headers

All responses include standard rate limit headers:

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1707580800
```

### Blocked Response

When blocked, clients receive:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 300
}
```

### Threat Logging

All detected threats are logged with:

- IP address
- User agent
- Timestamp
- Pattern matched
- Original input (truncated)

## Change Log

### 2026-02-10 - Initial Implementation

- Created duplicate-detection-service.ts with Levenshtein algorithm
- Created validation-service.ts with comprehensive validators
- Created rate-limiter.ts middleware
- Created data-quality.ts API routes
- Created 066_data_quality.sql migration
- Added 22 API endpoints
- Files created:
  - `server/services/duplicate-detection-service.ts`
  - `server/services/validation-service.ts`
  - `server/middleware/rate-limiter.ts`
  - `server/routes/data-quality.ts`
  - `server/database/migrations/066_data_quality.sql`
