#!/bin/sh
# Xcode Cloud runs this after cloning (it lives next to App.xcodeproj), before Swift packages are
# resolved. Nothing the Capacitor app needs at build time is committed: the web build goes into
# App/public, the generated capacitor.config.json next to it, and CapApp-SPM refers to the
# @capacitor/* plugins inside node_modules by path. So: install Node, build, sync.
set -e

REPO="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"

echo "=== Node ==="
export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node
node --version

echo "=== npm ci + web build + cap sync ios ==="
cd "$REPO"
# Electron and the desktop tooling are not needed for the iOS build
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
npm ci --no-audit --no-fund
npx vite build
npx cap sync ios
