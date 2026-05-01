# AI Features

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

AI-powered assistant features for the admin portal. Covers three sub-phases: AI proposal scope drafting (6A), AI email response drafting (6B), and enhanced semantic search with a global Cmd+K modal (6C). All AI features use the Anthropic API via the `@anthropic-ai/sdk` package. AI output is always a draft that the admin reviews and edits before use. Budget enforcement and daily rate limiting prevent runaway costs.

## Architecture

### Database Tables (Migration 129)

- `ai_usage_log` -- Tracks every AI API call. Columns: request_type, model, input_tokens, output_tokens, cost_cents, cache_hit, entity_type, entity_id, created_at. Indexed on created_at for budget aggregation queries.
- `ai_response_cache` -- Caches AI responses by SHA-256 hash of the request context. Columns: context_hash (UNIQUE), request_type, response_data (JSON), expires_at, created_at. TTL-based expiry cleaned up by a daily cron job.

### Cost Controls

- **Monthly budget cap** -- Configurable via `AI_MONTHLY_BUDGET_CENTS` environment variable. Defaults to 5000 ($50). Every request checks current month spend before calling the API.
- **Daily rate limit** -- Configurable via `AI_DAILY_REQUEST_LIMIT` environment variable. Defaults to 50. Only non-cached requests count against the limit.
- **Response caching** -- Identical request contexts (hashed with SHA-256) return cached responses within the TTL window (default 24 hours). Cache hits are free and do not count against the daily limit.
- **Usage logging** -- Every call (cached or not) is logged to `ai_usage_log` with token counts and calculated cost.

### Data Flow

1. Admin triggers AI draft from the proposal builder or messaging UI
2. Frontend calls `POST /api/admin/ai/draft-proposal` or `POST /api/admin/ai/draft-email`
3. Route handler validates input and calls `aiService.draftProposalScope()` or `aiService.draftEmail()`
4. Service checks monthly budget and daily rate limit
5. Service computes SHA-256 hash of the request context and checks cache
6. If cache hit: returns cached response, logs usage with `cache_hit = 1`
7. If cache miss: calls Anthropic API, stores response in cache, logs usage with token counts and cost
8. Admin receives draft text, edits as needed, then uses it in the proposal or email

## Configuration

**File:** `server/config/ai-config.ts`

Key configuration values (all overridable via environment variables):

- `model` -- Anthropic model ID (default: claude-sonnet-4-5-20250514)
- `maxTokensPerRequest` -- Output token limit per API call
- `monthlyBudgetCents` -- Monthly spending cap in cents
- `dailyRequestLimit` -- Max non-cached requests per day
- `cacheTtlSeconds` -- Cache entry lifetime (default: 86400 = 24 hours)
- `pricing` -- Per-model input/output token pricing for cost calculation
- `temperatures` -- Per-request-type temperature settings

## API Endpoints

All endpoints require admin authentication (requireAdmin middleware).

### AI Drafting

- `POST /api/admin/ai/draft-proposal` -- Draft proposal scope from project context. Accepts projectType, tier, features, budget, questionnaireResponses, clientName. Returns scope text, feature descriptions, and timeline narrative.
- `POST /api/admin/ai/draft-email` -- Draft email from thread/project context. Accepts purpose (follow_up, status_update, request_info, thank_you, custom), optional threadId for reply context, optional projectId for project context, optional customPrompt, optional tone. Returns subject and body text.

### Usage Monitoring

- `GET /api/admin/ai/usage` -- Current month usage summary: total cost, request count, breakdown by request type, budget remaining.
- `GET /api/admin/ai/usage/history` -- Monthly usage history for trend tracking.
- `GET /api/admin/ai/status` -- Service availability check: whether the API key is configured, budget remaining, daily limit remaining.

### Frontend API Constants

Constants defined in `api-endpoints.ts`:

- `AI_DRAFT_PROPOSAL` -- POST endpoint for proposal drafting
- `AI_DRAFT_EMAIL` -- POST endpoint for email drafting
- `AI_USAGE` -- GET endpoint for current month usage
- `AI_USAGE_HISTORY` -- GET endpoint for monthly history
- `AI_STATUS` -- GET endpoint for service status

## Service Layer

**File:** `server/services/ai-service.ts`

### Core Methods

- `draftProposalScope(context: DraftProposalContext)` -- Generates proposal scope text, feature descriptions, and timeline narrative from project context
- `draftEmail(context: DraftEmailContext)` -- Generates email subject and body from thread history, project context, and purpose
- `isAvailable()` -- Returns whether the AI service is configured and within budget/rate limits

### Usage Methods

- `getUsageSummary()` -- Current month totals: cost, request count, breakdown by type
- `getUsageHistory()` -- Monthly aggregates for historical trend display

### Maintenance Methods

- `cleanupExpiredCache()` -- Deletes cache entries past their TTL. Called by daily cron at 3:30 AM.

### Internal Methods

- Budget checking -- Aggregates current month cost from `ai_usage_log`, rejects if over cap
- Daily rate limiting -- Counts non-cached requests today, rejects if over limit
- Response caching -- SHA-256 hash of request context, lookup/store in `ai_response_cache`
- Cost calculation -- Computes cost in cents from model pricing and token counts

## Types

**File:** `server/services/ai-types.ts`

Key types:

- `DraftProposalContext` -- Input for proposal drafting (projectType, tier, features, budget, questionnaireResponses, clientName)
- `DraftProposalResult` -- Output from proposal drafting (scope, featureDescriptions, timeline)
- `DraftEmailContext` -- Input for email drafting (purpose, threadId, projectId, customPrompt, tone)
- `DraftEmailResult` -- Output from email drafting (subject, body, tokensUsed, cached)
- `AiUsageSummary` -- Monthly usage aggregation (totalCost, requestCount, byType breakdown)

## Enhanced Search (6C)

### Search Service Enhancements

**File:** `server/services/search-service.ts`

Expanded from 4 entity types to 9:

1. clients -- email, contact_name, company_name
2. projects -- project_name, project_code, project_type
3. messages -- message_text
4. invoices -- invoice_number, notes
5. proposals -- title, description
6. contracts -- content
7. leads -- name, email, company
8. tasks -- title, description
9. files -- file_name, label

Each entity type is queried in parallel using `Promise.allSettled()`. Results are merged and sorted by a relevance scoring algorithm:

- Exact match on identifier fields (invoice_number, project_code, email) scores highest
- Exact match on name/title fields scores next
- Partial match on name/title (LIKE) scores lower
- Match in description/content fields scores lower still
- Match in notes/comments scores lowest
- Recency boost for entities created in last 30 days
- Active/in-progress status boost

### CommandPalette Component

**File:** `src/react/components/portal/CommandPalette.tsx`

Global command palette / search overlay triggered by Cmd+K (Mac) / Ctrl+K (Windows). Integrated into `PortalApp.tsx` via the `useCommandPalette()` hook.

Features:

- Auto-focused search input with keyboard hint badge
- Debounced search (fires after typing pause)
- Results grouped by entity type with type icons (Lucide)
- Keyboard navigation: arrow up/down to move selection, Enter to navigate to selected result, Escape to close
- Recent searches stored in localStorage (shown when input is empty)
- Click or Enter on a result navigates to the entity and closes the modal

This is a portal-rendered overlay, not a route. It is available from any page in both admin and client portals.

## Scheduled Tasks

- `ai-cache-cleanup` -- Daily at 3:30 AM. Calls `aiService.cleanupExpiredCache()` to remove expired entries from `ai_response_cache`.

## Key Files

- `server/config/ai-config.ts` -- AI configuration (model, budget, limits, pricing, temperatures)
- `server/services/ai-types.ts` -- TypeScript types for AI contexts and results
- `server/services/ai-service.ts` -- Core AI service with drafting, caching, budget enforcement
- `server/routes/admin/ai.ts` -- Admin API endpoints (5 routes)
- `server/services/search-service.ts` -- Enhanced search with 9 entity types and relevance scoring
- `src/react/components/portal/CommandPalette.tsx` -- Global Cmd+K command palette

## Change Log

### 2026-03-17 -- Initial Implementation

- AI proposal drafting with Anthropic API integration
- AI email drafting with thread and project context
- Monthly budget enforcement and daily rate limiting
- SHA-256 response caching with configurable TTL
- Usage tracking and monitoring endpoints
- Search service expanded from 4 to 9 entity types with relevance scoring
- Global Cmd+K search modal with keyboard navigation and grouped results
- Daily cache cleanup cron job
