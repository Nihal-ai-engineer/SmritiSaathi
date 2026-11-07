# Activate Google sign-in locally

The real Google authorization-code integration is implemented, but intentionally disabled until you supply your own OAuth credentials. There is no fake Google login or hard-coded account.

1. In Google Cloud Console, create/select your project and configure Google Auth Platform branding, audience and consent. Use your own app name and contact email. If the app is in testing, add your Google account as a test user.
2. Create an OAuth client of type **Web application**.
3. Add this exact authorized redirect URI: `http://localhost:5173/api/auth/google/callback`.
4. Add `http://localhost:5173` as an authorized JavaScript origin if requested.
5. Open the project's private `.env` file and fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not paste the secret into chat, source control or frontend code.
6. Restart `pnpm dev`, open the app in a normal Chrome/Safari/Edge browser, and choose **Continue with Google**. Google may reject embedded in-app browsers; use an ordinary browser if that occurs.

New Google users choose an 8-character-minimum private-space password, save their recovery key and complete the normal care onboarding. Existing password users first sign in normally, then connect Google under **Care & privacy → Account security**, confirming their current password. Accounts are not silently merged just because their emails match.

Google verifies identity, not the private encryption key. On a remembered device the app can unlock using its device-protected key. On a fresh device Google login is followed by the private-space password. Password login and passkeys remain available. Google never supplies names, profile photos or memories to this app; only its stable identity identifier and verified email are retained.

Implementation: single-use state and nonce, browser-bound state cookie, PKCE, verified Google ID-token signature/audience/expiry/issuer, short-lived setup tickets, and server-only client secret. No Google access/refresh token is persisted. Only `openid` and `email` scopes are requested; there is no Drive, Photos or Gmail access.

Verification boundary: local disabled-configuration and invalid-flow behaviour can be tested without credentials. A real successful Google round-trip cannot be claimed until you configure your client and complete Google's consent/sign-in yourself. The domain and redirect URI must be updated when you deploy later.

Official setup reference: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
