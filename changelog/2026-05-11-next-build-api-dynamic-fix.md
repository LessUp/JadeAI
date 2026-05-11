# 2026-05-11 next build API dynamic fix

- Marked request-driven API routes with `dynamic = 'force-dynamic'` so Next.js no longer evaluates them during `next build` page-data collection.
- This prevents build-time SQLite access for auth, user, resume, interview, share, and chat session endpoints, fixing the `SQLITE_BUSY: database is locked` failure seen in Docker builds.
- Hardened the SQLite adapter for concurrent initialization by adding a short `busy_timeout` and ignoring duplicate migration or demo-seed work already completed by another build worker.
