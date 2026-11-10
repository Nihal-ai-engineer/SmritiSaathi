# SmritiSaathi — local full-stack application

A phone-first private care space for user-supplied memories, familiar people, routines and gentle practice. This is a working local development build, not a medically validated or production-certified service. No sample accounts, personal photos or care records are seeded.

## Run locally

Install Node.js 24+, pnpm and Docker Desktop. Start Docker, then run:

```sh
cd /you-local-path

pnpm install
pnpm local
```

Open **http://localhost:5173** (use localhost, not 127.0.0.1, for the configured login origin). `.env` has development-only settings; copy `.env.example` to `.env` if missing. Verification and recovery emails arrive at **http://localhost:58025**. They are not sent to real email addresses. Create your own account, save its recovery key, verify your email and complete onboarding. Keep the recovery key offline. No ChatGPT login is involved.

Stop the app with Ctrl+C. `docker compose stop` stops its services without deleting data. Do not use `docker compose down -v` unless you intentionally want to erase the database volumes.

This remains local; no domain, public server, tunnel, cloud database or paid service was created. Access from a physical phone needs a separately configured trusted HTTPS development origin; the current services deliberately bind only to loopback.

## Implemented

- New-account registration, email verification, password login, recovery-key-assisted password reset, password changes, account deletion, logout and logout-all.
- Password minimum: 8 characters, maximum: 128. Google sign-in/signup and explicit account linking are implemented; activate with your own server-side OAuth credentials using `docs/GOOGLE_LOGIN.md`. A real Google round-trip has not been verified without those credentials.
- Five-day sliding inactivity sessions. Encrypted remembered-device keys in IndexedDB; secure-context WebCrypto. Clearing browser data requires signing in again.
- WebAuthn passkey registration/login using PRF for vault unlocking on compatible authenticators. Password and recovery remain available. Hardware registration still needs testing on your actual devices.
- Required care-profile onboarding, consent notice, emergency contact, language and timezone; encrypted profile editing.
- Actual PostgreSQL persistence for encrypted memories, people, reminders, practice and wellbeing activity. Browser-side image resizing, metadata stripping and authenticated encrypted photo storage.
- Local private search over loaded records, pagination, detail/edit views, deletion confirmations and readable-record export (photos excluded).
- Explicit email-bound caregiver invitations, membership checks on every care endpoint, access removal and content-free activity log.
- Local memory matching, sequence recall and quizzes based on the user's own people/memories. No diagnosis or fabricated clinical score.
- Opt-in on-device WebLLM assistant. Model download needs internet and roughly 1 GB; replies need compatible WebGPU hardware. No cloud inference fallback and no private-record context is sent automatically.
- Phone bottom navigation, desktop sidebar, accessible form labels, large controls, reduced-motion support, error/empty/loading states, offline indicator, help and privacy information. English/Hindi core navigation and care flows; secondary settings/help/game text still includes English.

## Checks

```sh
pnpm build
pnpm test
```

API tests use temporary uniquely named test accounts in the configured LOCAL database and clean them up. Never point the test command at a real deployment. Tests cover hashing, verification gating, ownership isolation, encrypted-record persistence, stale-update rejection, session renewal/expiry, bad passkey challenge rejection and account deletion. Local test emails may remain in Mailpit. Browser/device-specific passkeys and model inference require separate real-device testing.

## Components and purpose

| Technology | Purpose |
|---|---|
| TypeScript, React, TSX, CSS | Phone-first screens, forms and local activity state |
| Vite | Local development and production frontend build |
| Node.js, Fastify, Zod | Validated API, authorization and error handling |
| PostgreSQL, pg | Persistent relational data, indexes, migrations and transactions |
| Redis | Shared API rate limits |
| Argon2id | Server-side hashing of domain-separated password-derived authentication credentials |
| WebCrypto AES-GCM and PBKDF2 | Browser encryption, vault wrapping and password/key separation |
| SimpleWebAuthn | Verified passkey challenges and authenticator responses |
| WebLLM | Local model inference; lazy-loaded only when requested |
| Nodemailer, Mailpit | Verification/recovery email with a safe local inbox |
| Docker Compose | Reproducible local database, rate-limit store and email services |
| Lucide | Interface icons, not personal imagery |
| Node test runner | Real API integration checks |

## Architecture and privacy boundary

Browser UI → same-origin API → PostgreSQL (ciphertext + metadata), Redis, local encrypted-file storage and local SMTP.

Care content is AES-256-GCM encrypted in the browser with a random profile key. Each member receives that key wrapped under their account vault. The account vault has separate password and offline recovery-key envelopes. Password-derived authentication credentials and vault-encryption keys use different salts; the server does not receive the vault password. Argon2id parameters are 64 MiB, three passes, parallelism one. This design requires an independent cryptography/security review before sensitive public use.

The operator can see login emails, account roles, memberships, timing, sizes and counts. There is no ordinary server-side key to read care content. **This is not an absolute promise that a service operator can never access it:** malicious frontend changes, compromised devices, browser extensions or stolen recovery keys can expose unlocked data. A non-extractable device key prevents ordinary key export, not malicious same-origin decryption. For protection from an actively malicious operator, consider a separately signed/auditable native client and a reviewed end-to-end protocol.

Invitations include a profile key in the URL fragment. Share only privately; browser history/clipboard can retain it. Revocation blocks future API access but does not erase previously downloaded material or rotate existing profile keys. No admin content viewer exists. Public moderation cannot inspect encrypted content without a user-controlled reporting design.

## 500,000 users: target, not a tested claim

The database uses UUIDs, foreign keys, indexed memberships, keyset pagination, pooled connections and migrations. These support a scaling path; they do not prove 500,000-user capacity. Registered accounts and simultaneous active users are different workloads. This local app has not been load-tested at that volume.

Before that launch: define concurrent users and media budgets; benchmark representative encrypted records; use managed HA PostgreSQL with PITR and PgBouncer; replace local photo files with private object storage; run stateless API replicas behind trusted HTTPS; configure connection/rate limits, storage quotas, email queues and abuse prevention; test backup restoration, failover, deletion retention and peak authentication memory consumption. Tune against measured p95 latency/error rates, not a promised user count. Redis stores rate limits, not encryption keys.

## Remaining launch work

- Independent security review, dependency audit remediation, stronger replay/content-binding design review and full end-to-end threat modelling.
- Real-device passkey/PRF and mobile WebGPU testing; low-memory phone compatibility.
- Complete Hindi translation and specialist accessibility/usability testing with caregivers.
- Scheduled background notifications, offline encrypted sync and installable/native Android/iOS packaging are not implemented. Loaded games can run without a network, but saving and a fresh app load need the local server.
- Public privacy/terms/support details and legal/clinical review; no medical efficacy claim.
- Physical deployment, trusted HTTPS, real SMTP, monitoring, alerting, backups and load tests. No production analytics/tracking is included.

See `docs/OPERATIONS.md` for backups and API routes. The original earlier prototype in the Codex workspace was left unchanged.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [SimpleWebAuthn PRF](https://simplewebauthn.dev/docs/advanced/prf), [WebCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey).
