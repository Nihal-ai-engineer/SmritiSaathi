#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v tailscale >/dev/null 2>&1; then
  tailscale_cli="$(command -v tailscale)"
elif [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then
  tailscale_cli=/Applications/Tailscale.app/Contents/MacOS/Tailscale
else
  echo "Install Tailscale on this Mac, sign in, and connect your phone to the same tailnet."
  echo "See docs/TAILNET.md, then run pnpm tailnet again."
  exit 1
fi

export TAILSCALE_BE_CLI=1
tailnet_status="$("$tailscale_cli" status --json 2>/dev/null || true)"
if [[ -z "$tailnet_status" ]]; then
  echo "Tailscale is not connected. Open Tailscale, sign in, and connect this Mac."
  exit 1
fi

tailnet_host="$(printf '%s' "$tailnet_status" | node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    try {
      const status = JSON.parse(input);
      if (status.BackendState !== "Running" || !status.Self?.Online) process.exit(1);
      const name = status.Self.DNSName?.replace(/\.$/, "");
      if (!name || !/^[a-z0-9.-]+\.ts\.net$/i.test(name)) process.exit(1);
      process.stdout.write(name);
    } catch { process.exit(1); }
  });
' || true)"
if [[ -z "$tailnet_host" ]]; then
  echo "Tailscale is not online or its private HTTPS name is unavailable."
  echo "Enable MagicDNS/HTTPS in Tailscale and try again."
  exit 1
fi

export APP_ORIGIN="https://$tailnet_host"
export TAILNET_MODE=1

pnpm services
pnpm db:migrate

echo "Private phone address: $APP_ORIGIN"
echo "The Mac and phone must both be connected to your Tailscale network."
echo "This uses Tailscale Serve, NOT public Funnel. Keep this terminal open."
echo "Google login needs a matching OAuth redirect; use password login until configured."

cleanup_tailnet() {
  "$tailscale_cli" serve --https=443 off >/dev/null 2>&1 || true
}
trap cleanup_tailnet EXIT

# Background Serve is idempotent, so restarting this command does not leave a
# second foreground listener competing for the private HTTPS port.
"$tailscale_cli" serve --bg 5173
pnpm dev
