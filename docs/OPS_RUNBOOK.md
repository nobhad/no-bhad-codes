# Ops Runbook

Quick reference for running, inspecting, and recovering the backend.
Written as "what to do when..." — not a tour of the codebase. Every
admin endpoint below is `requireAdmin` and lives under `/api/admin/`.

## Where to look first

| Symptom | First stop |
|---|---|
| User reports "something is slow" | `/api/admin/circuit-breakers` — is an upstream tripped? |
| Background work piling up | `/api/admin/async-tasks` — pending / dead counts |
| A recent deploy might have eaten data | `/api/admin/schema-drift` — did the schema change outside migrations? |
| Compliance / audit question | `/api/admin/audit-chain/verify` — is the tamper-evident chain intact? |
| Recent deploy looks wrong | `/api/admin/backups` — when did the last snapshot run? |
| Service is degraded everywhere | `/health` — what does the deep check say? |

The React admin has all of this surfaced at `/system-health` in the
portal.

---

## Circuit breakers

`/api/admin/circuit-breakers` returns every registered breaker's state.

States:
- **closed** — normal. Traffic flows to the upstream.
- **open** — threshold of failures crossed; we fast-fail for
  `cooldownMs` instead of calling the upstream. Callers see 503
  with `ServiceUnavailableError`. Trip is logged + Sentry paged.
- **half-open** — cooldown elapsed, a single probe was allowed.
  If that probe succeeds, we go back to `closed`; if it fails,
  back to `open`.

### Breakers that exist

| Name | Covers | Threshold | Cooldown |
|---|---|---|---|
| `stripe-api` | `stripe-payment-service` + `auto-pay-service` Stripe calls | 5 | 30s |
| `chat-webhook` | Slack + Discord integration webhooks | 3 | 60s |
| `tenant-webhook` | User-configured webhooks, workflow triggers, automation webhooks | 10 | 60s |
| `google-calendar` | Google OAuth token + Calendar API | 5 | 60s |

### When a breaker is open

1. Open the dashboard. The `openedAt` timestamp + `rejectedCount`
   tells you when it tripped and how many requests it's been
   swallowing.
2. Check the upstream. `stripe-api` open? Look at Stripe status.
   `tenant-webhook` open? Multiple customers' webhooks failing
   suggests a network / DNS problem.
3. Fix the upstream (or wait it out). The breaker reopens itself
   after cooldown. You don't need to "restart it."
4. If you need to **force-reset** a breaker: restart the process.
   There's no in-memory-only reset endpoint by design — breakers
   should recover on their own; manual reset is a foot-gun.

### When a breaker keeps flapping (closed → open → closed → open)

Upstream is partially healthy. Lower the threshold (or raise the
cooldown) in the service file that registered the breaker — this
is a code change, not a runtime control.

---

## Async task outbox

`/api/admin/async-tasks` returns counts by status. Add
`?status=dead&limit=50` to list offending rows.

Statuses:
- **pending** — waiting to run (or waiting out a backoff after
  a failed attempt).
- **running** — currently executing. Counts should be near 0
  except at tick time.
- **completed** — done. Payload cleared, last_error cleared.
  Pruned after 30 days by the daily cleanup.
- **failed** — transient placeholder. Shouldn't accumulate in
  this state; retries transition through `failed` on their way
  back to `pending`.
- **dead** — retries exhausted (or handler missing / payload
  unparseable). Kept 90 days for triage, then pruned. **Human
  attention needed.**

### When dead > 0

1. Hit `/api/admin/async-tasks?status=dead` to see offending tasks.
2. The `last_error` has been redacted (emails, tokens, secrets
   stripped) but gives you the shape of the failure.
3. Decide:
   - Handler bug → ship the fix, then manually re-enqueue the
     affected work (no built-in replay; see "re-enqueue" below).
   - Upstream no longer available → accept the loss; the payload
     is gone, so recovery from a backup is the only option.

### How to re-enqueue

There's no admin endpoint for this by design (too easy to misuse).
Open a DB console, INSERT a fresh row into `async_tasks` with the
same `task_type` and whatever payload you can reconstruct. The
drain picks it up on the next minute tick.

### Handler types registered today

- `intake.admin-notification` — fires after a new intake
- `intake.lead-score` — calculates lead score for the project
- `intake.save-file` — saves the intake JSON as a downloadable file

Adding a new handler: call `registerAsyncTaskHandler('<type>', fn)`
somewhere that loads at server start (usually the route module that
enqueues the task type). Handler MUST be idempotent — a retry
can fire after a partial-success crash.

---

## Audit log (tamper-evident chain)

`/api/admin/audit-chain/verify` walks the `audit_logs` table, recomputes
every row's hash from current content, and reports any rows whose
hash or prev_hash can't be reproduced.

The chain is SHA-256 with length-prefixed canonicalisation — see
`server/services/audit-logger.ts`. Not just a convention: if
somebody directly edits a historical row in the DB, the verifier
will flag it.

### When a break is reported

Every break is a **security incident**. Somebody mutated an audit
row outside the append path.

1. Don't overwrite. Don't re-baseline. Preserve state for forensics.
2. The report's `breaks[]` array gives you the row id, the kind
   (`hash_mismatch` / `prev_hash_mismatch` / `missing_hash`), and
   the row's `createdAt`.
3. `hash_mismatch` at row N: row N was edited.
4. `prev_hash_mismatch` at row N: row N-1 was edited (or a row
   between N-1 and N was deleted).
5. Pull a backup from before the window and diff the audit_logs
   table to identify the edit.
6. First 10 breaks are also surfaced on the System Health dashboard.

### Legitimate resets

Only one: after restoring from a backup (see Backup & Restore).
The verifier will report every row inserted since the backup as
"out of chain" because the stored fingerprint is from a later
time. After confirming the restore is what you meant, you can
let the chain pick up from the restored state — the new fingerprint
is captured on next clean boot.

---

## Schema drift

`/api/admin/schema-drift` captures the current `sqlite_master` state
and compares to the snapshot stored after the last successful boot.
Drift = something changed the schema outside the migration path.

Also checked at every startup. Drift in production **throws and the
container restarts** (unless `ACCEPT_SCHEMA_DRIFT=true` is set).

### Causes

- Manual ALTER TABLE in production (don't).
- A migration file that was edited after being applied.
- A migration that partially applied (crashed mid-way).
- A feature branch that ran its DDL against the shared DB.
- Restore from a backup that pre-dates some migrations.

### When drift is reported

1. `added` — extra objects (indexes, columns) not in the baseline.
2. `removed` — objects the baseline had but the live DB doesn't.
   Worst kind — someone dropped something.
3. `modified` — object exists in both but the CREATE SQL differs.
   Usually means an `ALTER TABLE` changed the shape.

### Accepting drift (deliberate)

You looked at the diff and the new state is correct:
1. Set `ACCEPT_SCHEMA_DRIFT=true` in the environment.
2. Restart. The current state is recorded as the new baseline.
3. Remove the env var. Next restart validates against the new baseline.

Don't leave `ACCEPT_SCHEMA_DRIFT=true` set permanently — it silences
the whole check.

---

## Backup & Restore

Daily at 03:30 UTC, the scheduler calls SQLite's online backup API
to produce a transactionally consistent snapshot, gzip it, and drop
it under `${BACKUP_DIR}/daily/` (default: sibling of `DATABASE_PATH`).
Seven-day rolling retention.

### List backups

```
GET /api/admin/backups
```

Returns the on-disk set with sizes + timestamps.

### Take an ad-hoc backup

Before a risky op (manual data edit, major migration):

```
POST /api/admin/backups/run
```

Runs the same code path as the nightly job. Returns
`{ file, bytes, prunedCount, durationMs }`.

### Restore

1. Stop the server. (Production: take the Railway service offline.)
2. Copy the target backup to a working directory:
   ```
   cp backups/daily/client_portal-2026-04-21-033000.sqlite.gz /tmp/restore/
   gunzip /tmp/restore/client_portal-2026-04-21-033000.sqlite.gz
   ```
3. Verify it opens:
   ```
   sqlite3 /tmp/restore/client_portal-2026-04-21-033000.sqlite '.schema'
   ```
4. Move it to the live path:
   ```
   mv data/client_portal.db data/client_portal.db.preserve-$(date +%s)
   mv /tmp/restore/client_portal-2026-04-21-033000.sqlite data/client_portal.db
   ```
5. Start the server. Startup will:
   - Run any pending migrations (safe; they're idempotent).
   - Detect schema drift (the fingerprint was for the snapshot, the
     current schema matches after migrations). This is **expected**
     after a restore — accept via `ACCEPT_SCHEMA_DRIFT=true` for one
     boot, then unset.

### Offsite backups

The current retention is local (same volume as the DB). A volume
loss wipes both. If this matters to you, add an offsite copy step
(rclone to S3 / similar) to `scheduleDbBackup` in
`server/services/scheduler-service.ts`.

---

## Secret rotation

Secrets that matter: `JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`, SMTP
credentials, `ADMIN_PASSWORD_HASH`, `GOOGLE_CLIENT_SECRET`.

### JWT_SECRET

Rotating forces everybody to re-login. Plan accordingly.

1. Generate the new secret: `openssl rand -hex 64`.
2. Set `JWT_SECRET=<new>` in the environment.
3. Redeploy. All existing cookies become invalid; users sign in again.

There's no two-key rotation window today. If you need one (long
sessions you don't want to invalidate), implement a "verify with
either old or new, sign with new" pattern in `middleware/auth.ts`
for the rollout period.

### STRIPE_WEBHOOK_SECRET

1. In Stripe → Webhooks, rotate the signing secret. Stripe shows
   the new secret once — copy it immediately.
2. Set `STRIPE_WEBHOOK_SECRET=<new>` in the environment.
3. Redeploy.
4. Verify with a test webhook delivery from the Stripe dashboard —
   the idempotency layer will dedupe it if it's been seen, so use
   a fresh event.

### SMTP credentials

1. Provision new credentials.
2. Update `SMTP_USER` / `SMTP_PASS` in the environment.
3. Redeploy. The transporter picks them up on next send.
4. Revoke the old credentials at the provider.

The existing `email_retry_queue` will re-drive any sends that
failed during the cutover.

### ADMIN_PASSWORD_HASH

```
node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD', 12))"
```

Set `ADMIN_PASSWORD_HASH=<output>` in the environment, redeploy.
Old hash invalid immediately; old admin sessions keep working
until the cookie expires (typically 1 hour for admin).

---

## Startup sequence (what to expect in logs)

Normal boot order:

```
OpenTelemetry initialized for <service>
Sentry instrumentation loaded
Database initialized
Observability metrics initialized
Database migrations complete
[Schema] First-boot baseline recorded        ← only on fresh volumes
Scheduler service started with N cron jobs
Server started on port <PORT>
```

If you see `[Schema] DRIFT DETECTED` during boot and the process
exits — see "Schema drift" above.

If you see `Migration failed` — the migration file is malformed or
conflicts with existing data. Don't `ACCEPT_SCHEMA_DRIFT` through
this. Fix the migration.

---

## Shutdown sequence (SIGTERM)

1. Scheduler stops — no new background work kicks off.
2. HTTP server stops accepting new connections.
3. DB pool drains (up to 20s) — in-flight transactions finish.
4. Sentry flushes (2s).
5. OpenTelemetry shuts down.
6. Process exits cleanly.

Force-exit after 28s total. If you see
`Forced shutdown after 28000ms` — something blocked the drain;
the tail of the log will include DB connection counts to hint at
what was stuck.

Railway's default SIGTERM→SIGKILL window is 30s. Our 28s budget
fits inside it with a 2s safety margin.
