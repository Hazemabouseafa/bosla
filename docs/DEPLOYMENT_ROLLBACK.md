# BOSLA Academy — Safe Rollback Procedure

Because every CI run publishes immutable commit-tagged Docker images (`sha-<7char>` and `commit-<40char>`), you can roll back `web`, `api`, and `worker` atomically in under a minute **without rebuilding on the VPS** and **without losing database or media data**.

---

## Option A: Instant Image Tag Rollback in Coolify (Recommended)

1. Identify the last known-good commit short SHA from GitHub Actions (**Build and Publish Production Docker Images -> Publish Rollback & Image Summary**) or `git log --oneline`.
   - Example tag: `sha-9f4e2a1`
2. Open the existing BOSLA Academy resource in Coolify -> **Environment Variables**.
3. Set:
   ```env
   BOSLA_IMAGE_TAG=sha-9f4e2a1
   ```
   This atomically pins all three prebuilt services (`boslaacademy-web`, `boslaacademy-api`, `boslaacademy-worker`) to the exact matching commit.
4. Click **Deploy / Restart** in Coolify.
   - Coolify pulls the immutable images from GHCR (or uses local cached layers) and swaps containers cleanly.
5. Verify `/api/v1/health` and core user flows.

---

## Option B: Rolling Back Across a Forward Database Migration

1. Prefer forward-compatible Prisma migrations (additive columns/tables before code depends on them, never dropping data columns on the same deploy).
2. If an urgent application rollback is needed **without reverting an already-applied additive SQL migration**, set in Coolify Environment Variables temporarily alongside the older `BOSLA_IMAGE_TAG`:
   ```env
   SKIP_DB_MIGRATIONS=true
   ```
3. Restart `api`, verify application stability, and restore `SKIP_DB_MIGRATIONS=false` before the next forward release.

---

## Option C: Permanent Rollback via Git

Once service is restored via Option A:
1. Revert the faulty commit cleanly on `main`:
   ```bash
   git revert <faulty_commit_sha>
   git push origin main
   ```
2. Wait for GitHub Actions to run tests and publish a fresh `:latest` and `:sha-<new>` image pair.
3. Return `BOSLA_IMAGE_TAG=latest` (or pin the new verified `sha-<new>`) and redeploy in Coolify.

---

## Prohibited Actions (Never Run During Incident Response)
- **NEVER** run `docker compose down -v` (deletes PostgreSQL, Redis, and uploaded video volumes).
- **NEVER** run `docker volume prune` or `docker system prune -a --volumes`.
- **NEVER** run `npx prisma migrate reset` on production.
