# Verification — 28 September 2026

## Passed locally

- Production TypeScript/Vite build.
- API integration suite against local PostgreSQL/Redis/Mailpit: account registration; password hashing; verification gate; wrong-origin rejection; per-profile authorization; ciphertext record persistence; stale-version conflict; five-day session renewal/expiry; invalid passkey challenge rejection; account deletion; local verification-email receipt.
- Crypto test: an eight-character password wraps and unlocks a vault; wrong password and wrong encryption key fail.
- Browser: password sign-in; mandatory two-step onboarding; empty dashboard; upload of a disposable one-pixel fixture with caption; encrypted image display after page reload; remembered-device unlock after reload.
- Phone viewport: 390 × 844, visible bottom navigation and usable memory form/card. Not a substitute for physical iPhone/Android testing.
- Production dependency audit after updates: no known vulnerabilities reported by the npm registry audit on this run. This does not certify security.
- Google without credentials: clear configuration status/error; protected context rejects anonymous requests.

Temporary API accounts were cleaned up by the tests. The browser QA account and its owned care profile/photo were removed after the checks. There are no bundled user accounts or personal-content seeds. Mailpit can retain disposable test emails.

## Not verified / not finished

- Live Google consent/token round-trip: requires the owner's OAuth client configuration.
- Successful hardware passkey registration and PRF vault unlocking: requires a compatible authenticator and user interaction.
- WebLLM model download and generated response on a physical phone; hardware/memory compatibility and model safety review.
- 500,000-account workload, concurrency, failover, backup restore and production security audit.
- Complete Hindi coverage, medical validation, app-store packaging, background push notifications and full offline synchronization.

Do not call the build production-ready or clinically validated based on these checks.
