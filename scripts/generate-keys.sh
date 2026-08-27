#!/usr/bin/env bash
# Generates the RS256 key pair used to sign/verify access tokens.
# Run once during first-time setup: npm run keys:generate
set -e

KEYS_DIR="$(dirname "$0")/../keys"
mkdir -p "$KEYS_DIR"

if [ -f "$KEYS_DIR/private.pem" ]; then
  echo "Keys already exist at $KEYS_DIR — remove them first if you want to regenerate."
  exit 0
fi

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEYS_DIR/private.pem"
openssl rsa -pubout -in "$KEYS_DIR/private.pem" -out "$KEYS_DIR/public.pem"

echo "✅ RS256 key pair generated in $KEYS_DIR"
echo "   private.pem — keep secret, never commit, only this service needs it"
echo "   public.pem  — safe to share with other services that need to verify tokens"
