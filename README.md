# Postgres Job Queue

A background job queue built on PostgreSQL instead of Redis — built to learn queue internals, Docker, and CI/CD from the ground up.

## Why Postgres instead of Redis?

Redis-based queues (BullMQ, Sidekiq) are faster and purpose-built for this. I chose Postgres deliberately, for a few reasons:

- **Transactional consistency** — a job can be enqueued in the same transaction as the business logic that creates it (e.g. "insert an order" and "enqueue a confirmation email" either both commit or neither does). With Redis, those are two separate systems, and a crash between them can silently drop a job.
- **No extra infrastructure** — if you already run Postgres, you don't need to stand up and operate a second data store just for background jobs.
- **Concurrency without an external lock service** — Postgres's `SELECT ... FOR UPDATE SKIP LOCKED` gives safe concurrent job claiming across multiple workers, using row-level locking the database already provides.

The tradeoff: this won't match Redis's raw throughput at very high volume. For a project at this scale, correctness and simplicity mattered more than squeezing out maximum jobs/second.

## How it works

Jobs live in a single `jobs` table. Producers (`enqueue`) insert rows. Workers (`claimJob`) atomically claim and lock one row at a time, so multiple workers can run concurrently without double-processing the same job.

```
enqueue() ──► [ jobs table ] ◄── claimJob() : worker loop
                                      │
                             process → completeJob() / failJob()
```

### Schema

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id serial primary key,
    type varchar(150),
    payload JSONB,
    status varchar(30) default 'pending',
    attempts int default 0,
    max_attempts int default 4,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Claiming a job safely

The core concurrency problem: two workers polling at the same instant could both read the same `pending` row before either marks it taken. The fix is to make "find a job" and "lock it" a single atomic operation:

```sql
UPDATE jobs
SET status = 'ongoing', updated_at = NOW()
WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'pending' AND run_at <= NOW()
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`FOR UPDATE` locks the row as part of the same query that reads it — no gap for a second worker to slip in. `SKIP LOCKED` means a worker that hits an already-locked row moves on to the next one instead of blocking, so all workers stay busy instead of queuing up behind each other.

### Retries and failure

`failJob` increments `attempts` and branches:
- Still under `max_attempts` → back to `pending`, with `run_at` pushed a few seconds into the future (basic backoff).
- Exceeded `max_attempts` → permanently `failed`.

### Crash recovery

If a worker crashes after claiming a job but before completing or failing it, that job is left stuck at `ongoing` forever — nothing else ever looks at it again. A separate `sweep.js` process runs on a timer, finds `ongoing` jobs whose `updated_at` is older than a threshold, and routes them through the same failure logic as a normal failure (so a job that always crashes its worker eventually gets marked permanently `failed` instead of retrying forever).

**Known limitation**: this is a fixed-timeout approach, not a heartbeat. A legitimately slow job that runs longer than the timeout can be marked stale and picked up by a second worker while the first is still running it, causing double-processing. A production version would use a heartbeat (the worker periodically touches `updated_at` while still working) so only truly abandoned jobs are recovered. Because of this, job handlers should be written to be idempotent — safe to run more than once.

## Running it

**Local development (worker/sweep run directly on your machine):**
```
docker-compose up -d postgres
npm install
node worker.js
node sweep.js
```

**Fully containerized:**
```
docker-compose up -d --build
```
This runs Postgres, the worker, and the sweep process each in their own container. The worker and sweep containers connect to Postgres via the service name (`DB_HOST=postgres`), not `localhost` — containers on the same Docker network reach each other by service name, not `localhost`, which only ever refers to the container itself.

## Testing

```
node --test
```

Tests use Node's built-in test runner. Each test cleans up its own rows in a `finally` block so repeated runs don't leave junk data behind or make later tests depend on leftover state.

## CI/CD

GitHub Actions runs on every push to `main`: spins up a fresh Postgres service container, installs dependencies, applies `schema.sql` to create the table, and runs the test suite — all on an empty environment with no manual setup.

## Project structure

```
queue.js       — enqueue, claimJob, completeJob, failJob
worker.js      — polling loop: claim → process → complete/fail
sweep.js       — recovers stale "ongoing" jobs
schema.sql     — table definition, used locally and in CI
Dockerfile     — image used by both the worker and sweep services
docker-compose.yml
.github/workflows/ci.yml
```

## Possible next steps

- Heartbeat-based stale job detection instead of a fixed timeout
- Dead-letter visibility (a dashboard or query for permanently failed jobs)

