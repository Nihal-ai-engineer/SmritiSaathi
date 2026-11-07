#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mobile_ip="${MOBILE_HOST_IP:-$(ipconfig getifaddr en0 2>/dev/null || true)}"
if [[ ! "$mobile_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Connect this Mac and your phone to the same Wi-Fi, then try again."
  echo "If Wi-Fi uses another interface, run: MOBILE_HOST_IP=your-mac-ip pnpm mobile"
  exit 1
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "Install mkcert first: brew install mkcert"
  echo "Then trust its local CA on this Mac: mkcert -install"
  exit 1
fi

mobile_cert_dir="$(pwd)/.data/mobile-tls"
mobile_cert="$mobile_cert_dir/$mobile_ip.pem"
mobile_key="$mobile_cert_dir/$mobile_ip-key.pem"
mkdir -p "$mobile_cert_dir"
if [[ ! -f "$mobile_cert" || ! -f "$mobile_key" ]]; then
  mkcert -cert-file "$mobile_cert" -key-file "$mobile_key" "$mobile_ip"
fi

export APP_ORIGIN="https://$mobile_ip:5173"
export MOBILE_TLS_CERT="$mobile_cert"
export MOBILE_TLS_KEY="$mobile_key"

pnpm services
pnpm db:migrate

echo "Open $APP_ORIGIN on your phone and Mac (same Wi-Fi)."
echo "The phone must trust this Mac's mkcert rootCA.pem; see docs/MOBILE.md."
echo "This is a local network development server, not public internet hosting."
pnpm dev
