#!/bin/sh
# Xcode Cloud runs this right before xcodebuild. It stamps the version the same way the GitHub
# workflow does for the other platforms – from the git tag – because the App Store rejects an
# upload whose CFBundleShortVersionString is not higher than the last approved one.
#
# * Tag build (v1.2.3, v1.2.3-rc1): the tag without the "v" and without a pre-release suffix,
#   since Apple allows only up to three dot-separated integers.
# * Branch build: the patch after the latest release tag (v1.2.3 → 1.2.4). Not the tag's own
#   version: once 1.2.3 is approved, App Store Connect closes that version to new builds, so a
#   build from main between releases has to go up as the next one.
# * Build number: Xcode Cloud's own counter, which only ever goes up.
set -e

REPO="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"
PBXPROJ="$REPO/ios/App/App.xcodeproj/project.pbxproj"
cd "$REPO"

if [ -n "$CI_TAG" ]; then
  TAG="$CI_TAG"
  VERSION="$(echo "$TAG" | sed -E 's/^v//; s/-.*$//')"
else
  # Xcode Cloud clones shallowly, so the release tags are usually not ancestors of HEAD in the
  # local history and `git describe` finds nothing. Take the highest vX.Y.Z tag instead: from the
  # local tags after a fetch, or straight from the remote if the fetch brought none.
  git fetch --tags --force --quiet 2>/dev/null || true
  TAG="$(git tag --list 'v[0-9]*' --sort=-v:refname | head -n 1)"
  if [ -z "$TAG" ]; then
    TAG="$(git ls-remote --tags --refs --sort=-v:refname origin 2>/dev/null \
      | sed 's|.*refs/tags/||' | grep -E '^v[0-9]' | head -n 1 || true)"
  fi
  BASE="$(echo "$TAG" | sed -E 's/^v//; s/-.*$//')"
  if echo "$BASE" | grep -Eq '^[0-9]+(\.[0-9]+){0,2}$'; then
    VERSION="$(echo "$BASE" | awk -F. '{ printf "%d.%d.%d", $1, $2, $3 + 1 }')"
  else
    VERSION=""
  fi
fi

if ! echo "$VERSION" | grep -Eq '^[0-9]+(\.[0-9]+){0,2}$'; then
  echo "error: no usable version from tag '$TAG' – tag releases as vX.Y.Z" >&2
  exit 1
fi

BUILD="${CI_BUILD_NUMBER:-1}"

sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VERSION;/g" "$PBXPROJ"
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $BUILD;/g" "$PBXPROJ"

echo "=== Version: $VERSION (build $BUILD) from tag '$TAG' ==="
grep -E 'MARKETING_VERSION|CURRENT_PROJECT_VERSION' "$PBXPROJ" | sort -u
