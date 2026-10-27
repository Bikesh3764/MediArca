# Database backup

The live server saves a copy of the whole database every night (FIX-050).

| What | Where |
|---|---|
| When | Once a day, after 3 AM IST. If the server missed it, it catches up within 30 minutes. |
| Where | Cloudflare R2 bucket `mediarca-db-backups` (private, no public link) |
| File | `daily/YYYY-MM-DD.dump` (Postgres custom format, already compressed) |
| Kept | The last 14 days. Older files are deleted automatically. |
| Code | `backend/src/utils/dbBackup.ts`, started from `server.ts` |

The files contain patient data. Never make this bucket public and never share the files.

## Check it is working

- Render logs show `[backup] saved daily/2026-10-28.dump (… KB, … ms)` once a day.
- Errors show as `[backup] failed …`. It retries every 30 minutes.
- In Cloudflare: R2 → `mediarca-db-backups` → `daily/` should show one file per day.

## Restore

Needs Postgres 17 tools (`pg_restore`) on a computer.

1. Download the file from Cloudflare (R2 → `mediarca-db-backups` → `daily/` → the date you want → Download).
2. **Try it on an empty test database first**, not on the live one:
   ```bash
   pg_restore --no-owner --no-privileges --dbname "postgresql://…test database…" 2026-10-28.dump
   ```
3. To replace the live data (this erases everything changed after the backup), put the site in maintenance mode first, then:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DIRECT_URL" 2026-10-28.dump
   ```
   Use the session connection (port 5432), not the 6543 pooler. Afterwards, check that every table still has row-level security on and that public API access is still revoked (FIX-030), because `--no-privileges` skips grants.

## Turn it off

Set `DB_BACKUP=off` on Render. A different bucket can be set with `DB_BACKUP_BUCKET`.
