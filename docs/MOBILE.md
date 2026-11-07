# Use SmritiSaathi on your phone (same Wi-Fi)

This keeps the database and private records on your Mac. The phone is another browser for the same account; it is **not** a public deployment. Keep the Mac awake and connected to the same trusted Wi-Fi as the phone.

1. On the Mac, install `mkcert` with `brew install mkcert`, then run `mkcert -install`. This creates a local development certificate authority and trusts it on the Mac.
2. In the project folder, run `pnpm mobile`. It starts the existing database services, the API on Mac loopback only, and an HTTPS browser server on the Mac's Wi-Fi address. It prints the phone URL.
3. On the phone, install **only the public root certificate** at `$(mkcert -CAROOT)/rootCA.pem` from your Mac. Transfer it directly (for example, AirDrop). **Never transfer `rootCA-key.pem` or any `*-key.pem` file.** On iPhone, open the certificate, install the downloaded profile in Settings, then enable full trust in Settings → General → About → Certificate Trust Settings. On Android, import the CA certificate through security settings (the wording varies by device). Remove the certificate from the phone when you no longer need local testing.
4. Open the exact `https://...:5173` address printed by `pnpm mobile` in your phone's browser and sign in with your existing account password. The phone may ask you to set up its own vault unlock or passkey; passkeys created for `localhost` do not transfer to a different hostname.

If the Mac has no active Wi-Fi address, connect it first. If Wi-Fi uses an interface other than `en0`, run `MOBILE_HOST_IP=<Mac LAN IPv4> pnpm mobile`. If macOS asks about incoming connections, allow them for this trusted Wi-Fi only. Do not port-forward 5173, use public Wi-Fi, or treat this development server as production hosting.

Google sign-in may not work at a private IP: its web OAuth redirect must be configured for a permitted HTTPS hostname. Password sign-in remains available. When a domain is ready, use proper public HTTPS hosting and configure the domain's Google redirect; do not use this local certificate for a public site.
