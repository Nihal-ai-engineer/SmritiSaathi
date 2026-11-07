# Private access from another network

This uses Tailscale **Serve**, not public Funnel. Only devices permitted in your tailnet can reach the app. The database, photos, and API remain on your Mac; the API and Vite process listen on Mac loopback only. The Mac must remain awake and online.

1. Install [Tailscale for macOS](https://tailscale.com/docs/install/mac) and the Tailscale app for your phone. Sign in to the **same tailnet** on both devices and connect the VPN. If using the standalone Mac app, enable its CLI integration in Tailscale Settings; the App Store app's bundled CLI is also supported by the script.
2. Enable MagicDNS and HTTPS for your tailnet if Tailscale asks you to. This provides a trusted `*.ts.net` address for phone browser encryption and passkeys.
3. In the SmritiSaathi project folder run `pnpm tailnet`. If macOS or Tailscale requests approval, review and allow the private Serve configuration. The command starts the existing Docker services, API, browser server, and Tailscale Serve. Leave its terminal open.
4. On your phone, with Tailscale connected, open the `https://...ts.net` address printed in Terminal. Sign in with your existing SmritiSaathi password. A passkey registered for `localhost` will not work on the new hostname; you can register a new one there.

No local `mkcert` certificate is needed for the Tailscale address. Do **not** run `tailscale funnel`, forward ports on your router, or use the same development server for a public deployment. Anyone already allowed into your tailnet may reach the app's login page; keep tailnet membership restricted.

Google login requires adding the exact `https://...ts.net/api/auth/google/callback` redirect URI to the Google OAuth web client. Until that is configured, use password login. Local Mailpit messages still appear at `http://localhost:58025` on the Mac. Verification links generated in this mode point to the tailnet address, so open them on the Mac or another device connected to the tailnet.
