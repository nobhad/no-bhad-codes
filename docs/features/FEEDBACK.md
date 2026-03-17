# Feedback Surveys and Testimonial Collection

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Post-project feedback system with three components: survey distribution (email-link or in-portal), response collection (star ratings + NPS + free text), and testimonial curation (approval workflow with publish/feature toggles). Surveys use token-based access so clients can respond via email link without logging in.

## Architecture

### Database Tables (Migration 127)

- `feedback_surveys` — Survey instances linked to a client and optionally a project. Each survey has a unique token for unauthenticated email-link access. Tracks status lifecycle: pending, sent, completed, expired.
- `feedback_responses` — 1:1 with survey (UNIQUE constraint on survey_id). Stores star ratings (1-5) for overall, communication, quality, and timeliness, plus NPS score (0-10), free-text highlights/improvements, and optional testimonial with consent flags.
- `testimonials` — Curated testimonials with approval workflow. Can be auto-created from survey responses (when client opts in) or manually created by admin. Status lifecycle: pending_review, approved, published, rejected. Supports featured flag for homepage display.

### Survey Types

- **project_completion** — Sent after a project is completed
- **milestone_check_in** — Mid-project checkpoint
- **nps_quarterly** — Periodic NPS measurement

### Survey Flow

1. Admin sends survey (or auto-triggered on project completion)
2. System generates unique token, creates survey record with status = 'sent'
3. Client receives email with link containing token
4. Client submits response (via email link or in-portal)
5. If client provides testimonial text and consents, testimonial record auto-created with status = 'pending_review'
6. Admin reviews testimonials, publishes or rejects

### NPS Calculation

NPS = % Promoters - % Detractors (range: -100 to +100)

- Promoters: NPS score 9-10
- Passives: NPS score 7-8
- Detractors: NPS score 0-6

## API Endpoints

### Admin (requireAdmin)

- `POST /api/feedback` — Send survey to client (creates survey, sends email)
- `GET /api/feedback/surveys` — List all surveys (filterable by status, survey type)
- `GET /api/feedback/analytics` — NPS score, average ratings, monthly trends, completion rate
- `GET /api/feedback/testimonials` — List testimonials (filterable by status, featured)
- `POST /api/feedback/testimonials` — Create testimonial manually
- `PUT /api/feedback/testimonials/:id` — Update testimonial
- `DELETE /api/feedback/testimonials/:id` — Delete testimonial
- `PUT /api/feedback/testimonials/:id/publish` — Publish testimonial
- `PUT /api/feedback/testimonials/:id/feature` — Toggle featured flag

### Client Portal (requireClient)

- `GET /api/feedback/my` — Client's pending and completed surveys

### Public (no auth, CSRF-exempt)

- `GET /api/feedback/survey/:token` — Survey form data (project name, client name, questions)
- `POST /api/feedback/survey/:token/submit` — Submit survey response
- `GET /api/feedback/testimonials/public` — Published testimonials
- `GET /api/feedback/testimonials/featured` — Featured testimonials only

### Frontend API Constants

Constants defined in `api-endpoints.ts`:

- `FEEDBACK` — Base path '/api/feedback'
- `FEEDBACK_SURVEYS` — '/api/feedback/surveys'
- `FEEDBACK_MY` — '/api/feedback/my'
- `FEEDBACK_ANALYTICS` — '/api/feedback/analytics'
- `FEEDBACK_TESTIMONIALS` — '/api/feedback/testimonials'
- `buildEndpoint`: feedbackSurveyPublic, feedbackSurveySubmit, testimonial, testimonialPublish, testimonialFeature

## Service Layer

**File:** `server/services/feedback-service.ts` (16 methods)

### Survey Methods

- `sendSurvey(data)` — Generate token, create survey, send email
- `listSurveys(filters)` — List with joined client/project names and response data
- `getSurveyByToken(token)` — Lookup for public form rendering
- `submitResponse(token, data)` — Validate, insert response, auto-create testimonial if consented, update survey status
- `getClientSurveys(clientId)` — Client's surveys for portal view

### Analytics Methods

- `getAnalytics(dateRange)` — NPS score, average ratings by category, monthly trends, completion rate, common themes

### Testimonial Methods

- `listTestimonials(filters)` — Filter by status, featured
- `createTestimonial(data)` — Manual creation (feedbackResponseId nullable)
- `updateTestimonial(id, data)` — Update text, status, etc.
- `deleteTestimonial(id)` — Hard delete
- `publishTestimonial(id)` — Set status = 'published', set published_at
- `toggleFeatured(id)` — Toggle featured flag
- `getPublicTestimonials()` — Published testimonials for public API
- `getFeaturedTestimonials()` — Featured + published testimonials

### Scheduler Methods

- `sendReminders()` — Send reminders for surveys sent 5+ days ago with no response and no prior reminder
- `expireOverdue()` — Expire surveys past their expires_at date

## Types

**File:** `server/services/feedback-types.ts`

Key interfaces:

- `FeedbackSurvey` — Survey record with joined names and optional enriched response
- `FeedbackResponse` — Star ratings, NPS, free text, testimonial consent flags
- `Testimonial` — Curated testimonial with status workflow and featured flag
- `FeedbackAnalytics` — NPS breakdown, average ratings, monthly trends, common themes
- `SendSurveyRequest` — Input for sending a survey
- `SubmitSurveyRequest` — Input for submitting a response

## React Components

### Admin

- `src/react/features/admin/feedback/FeedbackTable.tsx` — Survey list with send form, status filters, star rating display
- `src/react/features/admin/feedback/TestimonialsTable.tsx` — Testimonial management with publish/feature/reject actions, status badges
- `src/react/features/admin/feedback/FeedbackAnalytics.tsx` — NPS gauge, average ratings by category, response rate

### Client Portal

- `src/react/features/portal/feedback/PortalFeedback.tsx` — Card view of client's surveys (pending and completed)

### Portal Routes

- `/feedback` — Role-gated: admin sees FeedbackTable, client sees PortalFeedback
- `/feedback-analytics` — Admin only: FeedbackAnalytics dashboard
- `/testimonials` — Admin only: TestimonialsTable

## Scheduler

Two cron jobs registered in the scheduler:

- `feedback-reminders` — `0 10 * * *` (daily 10 AM) — Sends reminder emails for unanswered surveys
- `feedback-expiration` — `0 0 * * *` (daily midnight) — Expires surveys past their expiration date

## Edge Cases

- **Duplicate submission:** `feedback_responses.survey_id` has UNIQUE constraint; second submit returns 400
- **Expired survey:** Token lookup checks expires_at; returns 410 Gone if expired
- **Testimonial without consent:** Testimonial record only created if `testimonialApproved === true`
- **Manual testimonial:** Admin can create testimonials directly; `feedback_response_id` is nullable
- **NPS with zero responses:** Returns NPS = 0, not NaN

## Key Files

- `server/services/feedback-types.ts` — Types and constants
- `server/services/feedback-service.ts` — Service layer (16 methods)
- `server/routes/feedback/admin.ts` — Admin endpoints (9 routes)
- `server/routes/feedback/portal.ts` — Client portal endpoint (1 route)
- `server/routes/feedback/public.ts` — Public endpoints (4 routes, no auth)
- `src/react/features/admin/feedback/FeedbackTable.tsx` — Admin survey list
- `src/react/features/admin/feedback/TestimonialsTable.tsx` — Admin testimonial management
- `src/react/features/admin/feedback/FeedbackAnalytics.tsx` — Analytics dashboard
- `src/react/features/portal/feedback/PortalFeedback.tsx` — Client portal view

## Change Log

### 2026-03-17 — Initial Implementation

- Feedback survey system with token-based email access
- Star ratings (1-5) for 4 categories plus NPS (0-10)
- Testimonial approval workflow (pending_review, approved, published, rejected)
- Admin analytics with NPS gauge and rating breakdowns
- Client portal card view for survey status
- 2 scheduler crons for reminders and expiration
- Public API for published/featured testimonials (CSRF-exempt)
