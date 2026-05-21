#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh [patch|minor|major]
# Default: patch

BUMP="${1:-patch}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Must run from repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Ensure working tree is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is dirty. Commit or stash changes first."
  git status --short
  exit 1
fi

# Bump version in mcp/sutro/package.json (npm version also updates package-lock.json)
cd mcp/sutro
NEW_VERSION="$(npm version "$BUMP" --no-git-tag-version)"
# npm version returns e.g. "v0.1.6" — strip the leading v for the tag message
VERSION_NUM="${NEW_VERSION#v}"
cd "$REPO_ROOT"

echo "Bumped to $NEW_VERSION"

# Commit the version files
git add mcp/sutro/package.json mcp/sutro/package-lock.json
git commit -m "release $NEW_VERSION"

# Tag and push
git tag "$NEW_VERSION"
git push origin HEAD --tags

echo ""
echo "Released $NEW_VERSION — GitHub Actions will publish to npm shortly."
echo "https://github.com/adrianjonmiller/sutro-mcp-server/actions"
