# Local operations

## Configuration

`APP_ORIGIN` must exactly match the browser origin. Passkeys are bound to its hostname. A future domain change requires registering new passkeys there. Production requires HTTPS, real SMTP and Redis; do not reuse development passwords or expose Mailpit. `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `UPLOAD_DIR`, `PORT`, `DB_POOL_MAX` are server-only settings. Never put secrets into Vite-prefixed public variables.

Local development uses HTTP only on loopback; production cookies are Secure. Session IDs and action tokens are random and stored as hashes. The original password, vault keys and passkey PRF secrets are not stored by the API. Same-origin write checks and SameSite cookies protect the API; no wildcard CORS is enabled.

## Backups

Stop application writes before a consistent local backup. Keep PostgreSQL and `.data/uploads` together. The database contains encrypted care content but also readable account metadata, so protect backups too.

```sh
mkdir -p backups
docker compose exec -T postgres pg_dump -U smriti -d smritisaathi -Fc -f /tmp/smriti-backup.dump
docker compose cp postgres:/tmp/smriti-backup.dump backups/smriti-backup.dump
tar -czf backups/encrypted-uploads.tar.gz .data/uploads
```

These commands are instructions, not an automated backup schedule. The database service is named `postgres` in `compose.yaml`. Use a new timestamped backup destination to avoid replacing a prior backup. An empty app may not yet have an uploads directory. Restore into a separate empty database first using `pg_restore`, configure a separate uploads directory and port, apply migrations, then verify actual photo decryption with a test account. Do not overwrite the live database to test a restore.

For production define retention, encrypted off-site storage, access controls, PITR, RPO/RTO and deletion propagation. Backups cannot recover user encryption keys if all password/passkey/device/recovery paths have been lost.

## API map

Every care route requires a verified session and profile membership; profile edits, invitations, revocation and audit viewing require owner status. All write requests require the exact Origin and `X-Smriti-Client: 1`.

| Group | Routes |
|---|---|
| Health | GET `/api/health` |
| Account | POST `/api/auth/register`, `/login`, `/logout`, `/logout-all`, `/activity`; GET `/api/auth/me` |
| Verification | POST `/api/auth/resend`, `/verify` |
| Recovery | POST `/api/auth/forgot`, `/recovery-info`, `/reset` |
| Management | POST `/api/auth/password`, `/delete-account` |
| Passkeys | GET `/api/auth/passkeys`; POST its `/register-options`, `/register`, `/options`, `/authenticate`; DELETE `/:id` |
| Profiles | GET/POST `/api/profiles`; PUT `/api/profiles/:profileId` |
| Records | GET/POST `/api/profiles/:profileId/records`; PUT/DELETE `/:id` |
| Photos | POST `/api/profiles/:profileId/photos`; GET `/:id` |
| Care circle | GET `/api/profiles/:profileId/team`; POST `/invite`; DELETE `/team/:id`; POST `/api/invitations/accept` |
| Audit | GET `/api/profiles/:profileId/audit` |

Encrypted record list queries require `kind`; optional `cursor` is the previous page's last record ID and `limit` is at most 100. Updates require the current `version`; stale edits return 409. Search is intentionally client-side so plaintext search queries never go to the API. Encrypted input envelopes are validated server-side; semantic plaintext validation occurs on the client because the server cannot read it.

## Housekeeping before a long-running deployment

Add a scheduled job for expired sessions, challenges and action tokens. Remove orphaned encrypted uploads after a grace period with a transaction-safe job. Account deletion removes owned live care data and attempts file removal; disk failure needs a retry queue. Deleting individual records currently leaves their encrypted image as an orphan until housekeeping. Enforce per-account storage quotas and authentication concurrency limits before exposing this app publicly.
