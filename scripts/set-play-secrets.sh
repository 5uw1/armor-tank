#!/usr/bin/env bash
# Configure the GitHub repository secrets that turn on Android signing and the
# Google Play internal-testing upload in .github/workflows/build.yml.
#
# Usage:
#   scripts/set-play-secrets.sh <play-service-account.json> [upload-keystore.jks]
#
# Prompts for the keystore/key passwords (never echoed) and uses the `gh` CLI, so
# run `gh auth login` first. Re-run any time to rotate a value.
set -euo pipefail

SA_JSON="${1:-}"
KEYSTORE="${2:-armortank-upload.jks}"
KEY_ALIAS="${KEY_ALIAS:-upload}"
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

[[ -f "$SA_JSON" ]]  || { echo "Service account JSON not found: '$SA_JSON'"; exit 1; }
[[ -f "$KEYSTORE" ]] || { echo "Keystore not found: '$KEYSTORE'"; exit 1; }
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d.get("type")=="service_account", "not a service-account key file"' "$SA_JSON"

read -r -s -p "Keystore password: " STORE_PASSWORD; echo
read -r -s -p "Key password for alias '$KEY_ALIAS' (Enter = same as keystore): " KEY_PASSWORD; echo
KEY_PASSWORD="${KEY_PASSWORD:-$STORE_PASSWORD}"

# Fail fast locally instead of on the next tag build.
keytool -certreq -alias "$KEY_ALIAS" -keystore "$KEYSTORE" \
  -storepass "$STORE_PASSWORD" -keypass "$KEY_PASSWORD" >/dev/null

echo "Setting secrets on $REPO ..."
base64 -i "$KEYSTORE"          | gh secret set ANDROID_KEYSTORE_BASE64   --repo "$REPO"
printf '%s' "$STORE_PASSWORD"  | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$KEY_ALIAS"       | gh secret set ANDROID_KEY_ALIAS         --repo "$REPO"
printf '%s' "$KEY_PASSWORD"    | gh secret set ANDROID_KEY_PASSWORD      --repo "$REPO"
gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo "$REPO" < "$SA_JSON"

echo
gh secret list --repo "$REPO"
echo
echo "Done. Next tag push (e.g. 'git tag v1.0.1 && git push origin v1.0.1') will sign the AAB"
echo "and publish it to the Google Play internal testing track."
